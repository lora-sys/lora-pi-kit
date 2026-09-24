export async function stopOwnedContainer(
  name: string,
  run: (args: string[]) => Promise<unknown>,
): Promise<void> {
  await run(["rm", "--force", name]).catch(() => undefined);
  let absent = false;
  try {
    await run(["container", "inspect", name, "--format", "{{.State.Status}}"]);
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
    if (/No such (object|container)/i.test(stderr)) absent = true;
    else throw new Error(`Sandbox stop could not be verified: ${stderr || String(error)}`);
  }
  if (!absent) throw new Error("Sandbox container still exists after close");
}
