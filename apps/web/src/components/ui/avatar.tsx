import type { Member } from "@/lib/store";

/** Foto do membro ou, sem foto, a inicial do nome. Vai dentro de `.avatar` / `.pav`. */
export function AvatarFace({
  member,
}: {
  member?: Pick<Member, "name" | "avatar"> | null;
}) {
  if (member?.avatar) {
    return (
      <img
        className="avatar-img"
        src={member.avatar}
        alt=""
        draggable={false}
      />
    );
  }
  return <>{(member?.name[0] ?? "?").toUpperCase()}</>;
}
