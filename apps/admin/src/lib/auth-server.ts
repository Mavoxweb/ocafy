import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

type Auth = ReturnType<typeof createNeonAuth>;
let instance: Auth | undefined;

/** Criado sob demanda: o build não exige variáveis de ambiente. */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    instance ??= createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL as string,
      cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET as string },
    });
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
