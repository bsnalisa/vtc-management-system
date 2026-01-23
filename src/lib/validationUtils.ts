/**
 * Validation utilities for form inputs
 */

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Phone validation (supports various formats)
export function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters for validation
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

// South African ID number validation
export function isValidSAIdNumber(idNumber: string): boolean {
  if (!idNumber || idNumber.length !== 13) return false;
  
  // Must be all digits
  if (!/^\d{13}$/.test(idNumber)) return false;
  
  // Validate using Luhn algorithm
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = parseInt(idNumber.charAt(i), 10);
    if (i % 2 === 0) {
      sum += digit;
    } else {
      digit *= 2;
      sum += digit > 9 ? digit - 9 : digit;
    }
  }
  
  return sum % 10 === 0;
}

// Password strength validation
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
  strength: "weak" | "medium" | "strong";
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  let strength: "weak" | "medium" | "strong" = "weak";
  if (errors.length === 0) {
    strength = hasSpecial && password.length >= 12 ? "strong" : "medium";
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

// Required field validation
export function isRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// Number range validation
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// Date validation
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// Date is in future validation
export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  return date > now;
}

// Date is in past validation
export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  return date < now;
}

// Age validation from date of birth
export function getAgeFromDOB(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

// Minimum age validation
export function isMinimumAge(dob: string, minAge: number): boolean {
  return getAgeFromDOB(dob) >= minAge;
}

// URL validation
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Alphanumeric validation
export function isAlphanumeric(value: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(value);
}

// Name validation (allows letters, spaces, hyphens, apostrophes)
export function isValidName(name: string): boolean {
  return /^[a-zA-Z\s'-]+$/.test(name) && name.trim().length >= 2;
}

// Currency amount validation
export function isValidAmount(amount: number): boolean {
  return !isNaN(amount) && amount >= 0;
}

// File size validation (in bytes)
export function isValidFileSize(size: number, maxSizeMB: number): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return size <= maxBytes;
}

// File type validation
export function isValidFileType(filename: string, allowedTypes: string[]): boolean {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? allowedTypes.includes(extension) : false;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// National ID validation (basic alphanumeric, min 6 chars)
export function isValidNationalId(id: string): boolean {
  return id.length >= 6 && /^[A-Za-z0-9]+$/.test(id);
}

// Age validation
export function isValidAge(dateOfBirth: string, minAge = 16, maxAge = 100): boolean {
  const age = getAgeFromDOB(dateOfBirth);
  return age >= minAge && age <= maxAge;
}

// Min length validation
export function hasMinLength(value: string, minLength: number): boolean {
  return value.length >= minLength;
}

// Trainee registration validation
export function validateTraineeRegistration(data: {
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  trade?: string;
  trainingMode?: string;
  level?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isRequired(data.firstName)) {
    errors.firstName = 'First name is required';
  } else if (!hasMinLength(data.firstName || '', 2)) {
    errors.firstName = 'First name must be at least 2 characters';
  }

  if (!isRequired(data.lastName)) {
    errors.lastName = 'Last name is required';
  } else if (!hasMinLength(data.lastName || '', 2)) {
    errors.lastName = 'Last name must be at least 2 characters';
  }

  if (!isRequired(data.gender)) {
    errors.gender = 'Gender is required';
  }

  if (!isRequired(data.dateOfBirth)) {
    errors.dateOfBirth = 'Date of birth is required';
  } else if (!isValidAge(data.dateOfBirth || '')) {
    errors.dateOfBirth = 'Trainee must be between 16 and 100 years old';
  }

  if (!isRequired(data.idNumber)) {
    errors.idNumber = 'National ID is required';
  } else if (!isValidNationalId(data.idNumber || '')) {
    errors.idNumber = 'Invalid National ID format (min 6 alphanumeric characters)';
  }

  if (!isRequired(data.phone)) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(data.phone || '')) {
    errors.phone = 'Invalid phone number format';
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (!isRequired(data.address)) {
    errors.address = 'Address is required';
  }

  if (!isRequired(data.trade)) {
    errors.trade = 'Trade selection is required';
  }

  if (!isRequired(data.trainingMode)) {
    errors.trainingMode = 'Training mode is required';
  }

  if (!isRequired(data.level)) {
    errors.level = 'Training level is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// User form validation
export function validateUserForm(data: {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isRequired(data.email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email || '')) {
    errors.email = 'Invalid email format';
  }

  if (!isRequired(data.firstName)) {
    errors.firstName = 'First name is required';
  }

  if (!isRequired(data.lastName)) {
    errors.lastName = 'Last name is required';
  }

  if (!isRequired(data.role)) {
    errors.role = 'Role is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Format phone number for display
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('264')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}