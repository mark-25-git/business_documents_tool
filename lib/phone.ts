export const formatPhoneNumber = (input: string) => {
  if (!input) return '';
  input = input.trim().replace(/^'+/, '');

  // Remove all non-digit characters
  let digits = input.replace(/\D/g, '');

  // Keep an unfinished country code intact while typing. Otherwise the
  // eight-digit local-number rule turns 60123456 into 060123456 too early.
  const international = input.trim().startsWith('+');
  if (international && !digits.startsWith('60')) return '+' + digits;
  if (digits.startsWith('60') && digits.length < 10) {
    return (international ? '+' : '') + digits;
  }

  // Remove country code if present (+60 or 60)
  // Malaysian numbers: 10-12 digits with country code, 8-10 digits without
  if (digits.startsWith('60') && digits.length >= 10) {
    digits = '0' + digits.substring(2);
  }

  // Must start with 0 for Malaysian numbers
  if (!digits.startsWith('0')) {
    // If valid length without 0, add it
    if (digits.length >= 8 && digits.length <= 10) {
      digits = '0' + digits;
    } else {
      return digits; // Return cleaned digits if doesn't match
    }
  }

  // Fixed line numbers with 3-digit area codes (088, 089): 8, 9, 10, or 11 digits total
  // Check for 3-digit area codes first, before 2-digit area codes
  if (digits.startsWith('088') || digits.startsWith('089')) {
    if (digits.length === 8 || digits.length === 9 || digits.length === 10 || digits.length === 11) {
      return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }
  }

  // Mobile numbers: 01x-xxxxxxx or 01x-xxxxxxxx (9, 10, or 11 digits total)
  // Check mobile numbers before other fixed line numbers
  // Note: 011 is a special case - it's a 3-digit area code, not mobile
  if (digits.startsWith('01') && !digits.startsWith('011') && !digits.startsWith('088') && !digits.startsWith('089')) {
    if (digits.length === 9) {
      return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }
    if (digits.length === 10) {
      return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }
    if (digits.length === 11) {
      return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }
  }

  // Fixed line numbers with 2-digit area codes (03, 04, 07, etc.): 8, 9, 10, or 11 digits total
  // 8-digit numbers are always treated as fixed line (even if they start with 01)
  if (digits.length === 8) {
    return `${digits.substring(0, 2)}-${digits.substring(2)}`;
  }

  // Fixed line numbers with 2-digit area codes: 9, 10, or 11 digits total
  // Exclude mobile numbers (01x with 9-11 digits) which are already handled above
  // Also exclude 3-digit area codes (088, 089, 011) which are already handled
  if (digits.length === 9 && !digits.startsWith('01')) {
    return `${digits.substring(0, 2)}-${digits.substring(2)}`;
  }
  if (digits.length === 10 && !digits.startsWith('01')) {
    return `${digits.substring(0, 2)}-${digits.substring(2)}`;
  }
  if (digits.length === 11 && !digits.startsWith('01')) {
    return `${digits.substring(0, 2)}-${digits.substring(2)}`;
  }

  // Handle 011 as 3-digit area code (special case)
  if (digits.startsWith('011') && (digits.length === 9 || digits.length === 10 || digits.length === 11)) {
    return `${digits.substring(0, 3)}-${digits.substring(3)}`;
  }

  // Partial input - return digits as user types
  return digits;
};

export function phoneError(input: string): string | undefined {
  const value = formatPhoneNumber(input);
  if (!value) return;
  if (/^01\d-\d{7,8}$/.test(value) || /^0[3-9]-\d{6,9}$/.test(value) || /^08[89]-\d{5,8}$/.test(value)) return;
  if (/^\+[1-9]\d{6,14}$/.test(value) && !value.startsWith("+60")) return;
  return "Enter a complete Malaysian phone number or an international number with + and country code.";
}

// The apostrophe is a Sheets text marker, never part of the displayed number.
export function phoneForSheet(value: unknown): string {
  const formatted = formatPhoneNumber(String(value ?? ""));
  return formatted ? "'" + formatted : "";
}
