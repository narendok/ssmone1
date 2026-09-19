import { createServerFn } from "@tanstack/react-start";

export const bootstrapSsmOneFoundation = createServerFn({ method: "POST" })
  .handler(async () => {
    const { bootstrapSsmOne } = await import("./ssm-admin.server");
    return bootstrapSsmOne();
  });