/** Link that opens the sign-up already inside a household. */
export function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}join/${code}`;
}
