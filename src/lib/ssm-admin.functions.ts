import { createServerFn } from "@tanstack/react-start";
import { bootstrapSsmOne } from "./ssm-admin.server";

export const bootstrapSsmOneFoundation = createServerFn({ method: "POST" })
  .handler(async () => bootstrapSsmOne());