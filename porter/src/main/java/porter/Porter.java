package porter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Handle;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.commons.ClassRemapper;
import org.objectweb.asm.commons.SimpleRemapper;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.InvokeDynamicInsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;

/**
 * Rewrites references inside an already compiled mod jar so it links against a newer
 * Minecraft version, without decompiling it. Everything that is not matched by a rule is
 * copied byte-for-byte.
 *
 * <p>Rules file (one rule per line, '#' starts a comment):
 * <pre>
 * shim    com/example/port/Compat                     # class that receives "shim" redirects
 * shim    client com/example/port/ClientCompat        # class that receives "shim:client" redirects
 * class   old/pkg/Name new/pkg/Name                    # class moved/renamed
 * field   owner name desc -> newOwner newName newDesc  # field moved/renamed
 * field   owner name desc -> shim                      # field read/write becomes a static call
 * method  owner name desc -> newOwner newName newDesc  # method moved/renamed (same kind of call)
 * method  owner name desc -> shim                      # call becomes a static call on the shim
 * (field|method) ... in some/Class                     # only apply inside some/Class (and its nested classes)
 * bridge  some/Class name desc -> newName newDesc 0,1  # add newName(newDesc) to some/Class that calls
 *                                                      # this.name(desc) with the given argument indices
 *                                                      # ("-" for none); the new return type may be a
 *                                                      # supertype of the old one
 * unwrap-lambda iface/Name sam samDesc                  # a non-capturing lambda implementing iface/Name
 *                                                      # becomes a direct call of its body
 * </pre>
 * Shim methods are named {@code <OwnerSimpleName>_<name>} (fields: {@code ..._get}/{@code ..._set}).
 * Instance members get the owner as an extra first parameter.
 *
 * <p>Usage: {@code Porter <in.jar> <out.jar> <rules[,rules...]> [unused-rules-report]}
 */
public final class Porter {
    private record Member(String owner, String name, String desc) {
    }

    private record Target(String owner, String name, String desc, String shim, String scope) {
        boolean appliesTo(String className) {
            return this.scope == null || className.equals(this.scope) || className.startsWith(this.scope + "$");
        }
    }

    private record Bridge(String name, String desc, String newName, String newDesc, int[] args) {
    }

    private record Sam(String owner, String name, String desc) {
    }

    private final Map<String, String> classes = new HashMap<>();
    private final Map<Member, List<Target>> fields = new HashMap<>();
    private final Map<Member, List<Target>> methods = new HashMap<>();
    private final Map<String, List<Bridge>> bridges = new HashMap<>();
    private final Set<Sam> unwrap = new HashSet<>();
    private final Set<Member> used = new HashSet<>();
    private final Map<String, String> shims = new HashMap<>();

    public static void main(String[] args) throws IOException {
        Porter porter = new Porter();
        for (String rules : args[2].split(","))
            porter.readRules(Path.of(rules));
        porter.process(Path.of(args[0]), Path.of(args[1]));
        Set<String> unused = new TreeSet<>();
        porter.fields.keySet().stream().filter(m -> !porter.used.contains(m)).forEach(m -> unused.add("field " + m));
        porter.methods.keySet().stream().filter(m -> !porter.used.contains(m)).forEach(m -> unused.add("method " + m));
        porter.bridges.keySet().stream().filter(c -> !porter.usedBridges.contains(c)).forEach(c -> unused.add("bridge " + c));
        porter.unwrap.stream().filter(u -> !porter.usedUnwraps.contains(u)).forEach(u -> unused.add("unwrap-lambda " + u));
        if (args.length > 3)
            Files.write(Path.of(args[3]), unused);
    }

    private void readRules(Path file) throws IOException {
        try (BufferedReader reader = Files.newBufferedReader(file)) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                int comment = line.indexOf('#');
                if (comment >= 0)
                    line = line.substring(0, comment);
                line = line.trim();
                if (line.isEmpty())
                    continue;
                String[] p = line.split("\\s+");
                try {
                    switch (p[0]) {
                        case "shim" -> this.shims.put(p.length > 2 ? p[1] : "", p.length > 2 ? p[2] : p[1]);
                        case "class" -> this.classes.put(p[1], p[2]);
                        case "field", "method" -> {
                            Member from = new Member(p[1], p[2], p[3]);
                            if (!p[4].equals("->"))
                                throw new IllegalArgumentException("expected ->");
                            boolean isShim = p[5].equals("shim") || p[5].startsWith("shim:");
                            int next = isShim ? 6 : 8;
                            String scope = null;
                            if (p.length > next) {
                                if (!p[next].equals("in") || p.length != next + 2)
                                    throw new IllegalArgumentException("expected 'in <class>'");
                                scope = p[next + 1];
                            }
                            Target to = isShim ? new Target(null, null, null, p[5].equals("shim") ? "" : p[5].substring(5), scope) : new Target(p[5], p[6], p[7], null, scope);
                            (p[0].equals("field") ? this.fields : this.methods).computeIfAbsent(from, k -> new ArrayList<>()).add(to);
                        }
                        case "bridge" -> {
                            if (!p[4].equals("->"))
                                throw new IllegalArgumentException("expected ->");
                            int[] argIndices = p[7].equals("-") ? new int[0] : Arrays.stream(p[7].split(",")).mapToInt(Integer::parseInt).toArray();
                            this.bridges.computeIfAbsent(p[1], k -> new ArrayList<>()).add(new Bridge(p[2], p[3], p[5], p[6], argIndices));
                        }
                        case "unwrap-lambda" -> this.unwrap.add(new Sam(p[1], p[2], p[3]));
                        default -> throw new IllegalArgumentException("unknown rule " + p[0]);
                    }
                } catch (RuntimeException e) {
                    throw new IllegalArgumentException(file + ":" + lineNumber + ": " + e.getMessage(), e);
                }
            }
        }
    }

    private void process(Path in, Path out) throws IOException {
        Files.createDirectories(out.toAbsolutePath().getParent());
        try (ZipInputStream zin = new ZipInputStream(Files.newInputStream(in)); OutputStream fout = Files.newOutputStream(out); ZipOutputStream zout = new ZipOutputStream(fout)) {
            ZipEntry entry;
            while ((entry = zin.getNextEntry()) != null) {
                byte[] data = zin.readAllBytes();
                ZipEntry outEntry = new ZipEntry(entry.getName());
                outEntry.setTime(entry.getTime());
                if (!entry.isDirectory() && entry.getName().endsWith(".class"))
                    data = this.transform(data);
                zout.putNextEntry(outEntry);
                if (!entry.isDirectory())
                    zout.write(data);
                zout.closeEntry();
            }
        }
    }

    private byte[] transform(byte[] data) {
        ClassNode node = new ClassNode();
        new ClassReader(data).accept(node, 0);
        boolean changed = false;
        for (MethodNode method : node.methods) {
            for (AbstractInsnNode insn : method.instructions.toArray()) {
                if (insn instanceof FieldInsnNode f) {
                    Target t = find(this.fields, new Member(f.owner, f.name, f.desc), node.name);
                    if (t == null)
                        continue;
                    this.used.add(new Member(f.owner, f.name, f.desc));
                    changed = true;
                    if (t.shim == null) {
                        f.owner = t.owner;
                        f.name = t.name;
                        f.desc = t.desc;
                        continue;
                    }
                    String base = simpleName(f.owner) + "_" + f.name;
                    Type type = Type.getType(f.desc);
                    Type owner = Type.getObjectType(f.owner);
                    MethodInsnNode call = switch (f.getOpcode()) {
                        case Opcodes.GETSTATIC -> new MethodInsnNode(Opcodes.INVOKESTATIC, this.shim(t.shim), base + "_get", Type.getMethodDescriptor(type), false);
                        case Opcodes.PUTSTATIC -> new MethodInsnNode(Opcodes.INVOKESTATIC, this.shim(t.shim), base + "_set", Type.getMethodDescriptor(Type.VOID_TYPE, type), false);
                        case Opcodes.GETFIELD -> new MethodInsnNode(Opcodes.INVOKESTATIC, this.shim(t.shim), base + "_get", Type.getMethodDescriptor(type, owner), false);
                        default -> new MethodInsnNode(Opcodes.INVOKESTATIC, this.shim(t.shim), base + "_set", Type.getMethodDescriptor(Type.VOID_TYPE, owner, type), false);
                    };
                    method.instructions.set(f, call);
                } else if (insn instanceof MethodInsnNode m) {
                    Member key = new Member(m.owner, m.name, m.desc);
                    Target t = find(this.methods, key, node.name);
                    if (t == null)
                        continue;
                    if (m.name.equals("<init>"))
                        throw new IllegalStateException("Constructors can't be redirected: " + key + " in " + node.name);
                    this.used.add(key);
                    changed = true;
                    if (t.shim == null) {
                        m.owner = t.owner;
                        m.name = t.name;
                        m.desc = t.desc;
                        continue;
                    }
                    String desc = m.getOpcode() == Opcodes.INVOKESTATIC ? m.desc : prependArg(m.owner, m.desc);
                    if (m.getOpcode() == Opcodes.INVOKESPECIAL)
                        throw new IllegalStateException("super calls can't be shimmed: " + key + " in " + node.name);
                    method.instructions.set(m, new MethodInsnNode(Opcodes.INVOKESTATIC, this.shim(t.shim), simpleName(m.owner) + "_" + m.name, desc, false));
                } else if (insn instanceof InvokeDynamicInsnNode indy) {
                    if (this.isUnwrappable(indy)) {
                        Handle impl = (Handle) indy.bsmArgs[1];
                        method.instructions.set(indy, new MethodInsnNode(Opcodes.INVOKESTATIC, impl.getOwner(), impl.getName(), impl.getDesc(), impl.isInterface()));
                        changed = true;
                        continue;
                    }
                    for (int i = 0; i < indy.bsmArgs.length; i++) {
                        if (indy.bsmArgs[i] instanceof Handle h) {
                            Handle n = this.handle(h, node.name);
                            if (n != h) {
                                indy.bsmArgs[i] = n;
                                changed = true;
                            }
                        }
                    }
                }
            }
        }
        List<Bridge> classBridges = this.bridges.get(node.name);
        if (classBridges != null) {
            for (Bridge b : classBridges) {
                node.methods.add(createBridge(node, b));
                changed = true;
            }
            this.usedBridges.add(node.name);
        }
        if (!changed && this.classes.isEmpty())
            return data;
        byte[] result = write(node, this.classes);
        // Keep the original bytes of classes that don't reference anything that was renamed.
        if (!changed && Arrays.equals(result, write(node, Map.of())))
            return data;
        return result;
    }

    private static byte[] write(ClassNode node, Map<String, String> renames) {
        ClassWriter writer = new ClassWriter(0);
        node.accept(new ClassRemapper(writer, new SimpleRemapper(renames)));
        return writer.toByteArray();
    }

    private final Set<String> usedBridges = new HashSet<>();

    private Target find(Map<Member, List<Target>> rules, Member key, String className) {
        List<Target> targets = rules.get(key);
        if (targets == null)
            return null;
        for (Target t : targets)
            if (t.appliesTo(className))
                return t;
        return null;
    }

    private boolean isUnwrappable(InvokeDynamicInsnNode indy) {
        if (!indy.bsm.getOwner().equals("java/lang/invoke/LambdaMetafactory") || indy.bsmArgs.length < 3)
            return false;
        Type returned = Type.getReturnType(indy.desc);
        if (Type.getArgumentTypes(indy.desc).length != 0 || returned.getSort() != Type.OBJECT)
            return false;
        Sam sam = new Sam(returned.getInternalName(), indy.name, ((Type) indy.bsmArgs[0]).getDescriptor());
        if (!this.unwrap.contains(sam))
            return false;
        Handle impl = (Handle) indy.bsmArgs[1];
        if (impl.getTag() != Opcodes.H_INVOKESTATIC || Type.getArgumentTypes(impl.getDesc()).length != 0)
            throw new IllegalStateException("Can only unwrap static no-arg lambdas: " + impl);
        this.usedUnwraps.add(sam);
        return true;
    }

    private final Set<Sam> usedUnwraps = new HashSet<>();

    private static MethodNode createBridge(ClassNode node, Bridge b) {
        Type[] newArgs = Type.getArgumentTypes(b.newDesc);
        Type[] oldArgs = Type.getArgumentTypes(b.desc);
        if (oldArgs.length != b.args.length)
            throw new IllegalStateException("Bridge argument count mismatch for " + node.name + "." + b.name);
        Type oldReturn = Type.getReturnType(b.desc);
        Type newReturn = Type.getReturnType(b.newDesc);
        // A different return type is only allowed for references (covariant returns, e.g. Matrix3x2f -> Matrix3x2fc)
        boolean references = oldReturn.getSort() >= Type.ARRAY && newReturn.getSort() >= Type.ARRAY;
        if (!oldReturn.equals(newReturn) && !references)
            throw new IllegalStateException("Bridge return type mismatch for " + node.name + "." + b.name);
        // Synthetic, so compilers building against the ported jar ignore it
        MethodNode m = new MethodNode(Opcodes.ACC_PUBLIC | Opcodes.ACC_SYNTHETIC | Opcodes.ACC_BRIDGE, b.newName, b.newDesc, null, null);
        int[] slots = new int[newArgs.length];
        int slot = 1;
        for (int i = 0; i < newArgs.length; i++) {
            slots[i] = slot;
            slot += newArgs[i].getSize();
        }
        m.visitCode();
        m.visitVarInsn(Opcodes.ALOAD, 0);
        int stack = 1;
        for (int i = 0; i < b.args.length; i++) {
            Type t = newArgs[b.args[i]];
            if (!t.equals(oldArgs[i]))
                throw new IllegalStateException("Bridge argument type mismatch for " + node.name + "." + b.name);
            m.visitVarInsn(t.getOpcode(Opcodes.ILOAD), slots[b.args[i]]);
            stack += t.getSize();
        }
        m.visitMethodInsn(Opcodes.INVOKEVIRTUAL, node.name, b.name, b.desc, false);
        m.visitInsn(Type.getReturnType(b.desc).getOpcode(Opcodes.IRETURN));
        m.visitMaxs(Math.max(stack, Type.getReturnType(b.desc).getSize()), slot);
        m.visitEnd();
        return m;
    }

    private Handle handle(Handle h, String className) {
        boolean field = h.getTag() <= Opcodes.H_PUTSTATIC;
        Member key = new Member(h.getOwner(), h.getName(), h.getDesc());
        Target t = find(field ? this.fields : this.methods, key, className);
        if (t == null)
            return h;
        if (field)
            throw new IllegalStateException("Field handles aren't supported: " + key);
        this.used.add(key);
        if (t.shim == null)
            return new Handle(h.getTag(), t.owner, t.name, t.desc, h.getTag() == Opcodes.H_INVOKEINTERFACE);
        String desc = h.getTag() == Opcodes.H_INVOKESTATIC ? h.getDesc() : prependArg(h.getOwner(), h.getDesc());
        return new Handle(Opcodes.H_INVOKESTATIC, this.shim(t.shim), simpleName(h.getOwner()) + "_" + h.getName(), desc, false);
    }

    private String shim(String name) {
        String shim = this.shims.get(name);
        if (shim == null)
            throw new IllegalStateException("No 'shim " + name + "' rule for shim redirects");
        return shim;
    }

    private static String prependArg(String owner, String desc) {
        Type[] args = Type.getArgumentTypes(desc);
        List<Type> all = new ArrayList<>(args.length + 1);
        all.add(Type.getObjectType(owner));
        all.addAll(List.of(args));
        return Type.getMethodDescriptor(Type.getReturnType(desc), all.toArray(Type[]::new));
    }

    private static String simpleName(String internalName) {
        return internalName.substring(internalName.lastIndexOf('/') + 1).replace('$', '_');
    }
}
