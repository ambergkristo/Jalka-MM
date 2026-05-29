export function confirmationFromArgv(argv: string[]): string | undefined {
  const arg = argv.find((item) => item.startsWith('--confirm='));
  return arg?.slice('--confirm='.length);
}
