import { auth } from "@/lib/auth-server";

type Handler = ReturnType<typeof auth.handler>;
let handler: Handler | undefined;
const get = () => {
  handler ??= auth.handler();
  return handler;
};

export const GET: Handler["GET"] = (...args) => get().GET(...args);
export const POST: Handler["POST"] = (...args) => get().POST(...args);
