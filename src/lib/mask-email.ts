/**
 * Obscures an email for display, keeping the first character of the local part
 * and of the domain label while preserving the TLD.
 *
 *   decano@gmail.com -> d*****@g****.com
 *
 * Inputs without an "@" are returned unchanged.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return email;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  const labels = domain.split(".");
  const [firstLabel, ...rest] = labels;

  const maskedLocal = maskLabel(local);
  const maskedDomain = [maskLabel(firstLabel), ...rest].join(".");

  return `${maskedLocal}@${maskedDomain}`;
}

function maskLabel(label: string): string {
  if (label.length <= 1) return label;
  return label[0] + "*".repeat(label.length - 1);
}
