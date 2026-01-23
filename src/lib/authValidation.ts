import { z } from "zod";

// Email validation schema
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email must be less than 255 characters");

// Password validation schema with security requirements
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be less than 72 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Signup form schema with password confirmation
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    firstName: z.string().min(1, "First name is required").max(50),
    lastName: z.string().min(1, "Last name is required").max(50),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// User profile update schema
export const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  phone: z
    .string()
    .regex(/^[+]?[\d\s()-]{10,20}$/, "Please enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

// User creation schema (admin)
export const userCreationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  phone: z
    .string()
    .regex(/^[+]?[\d\s()-]{10,20}$/, "Please enter a valid phone number")
    .optional()
    .or(z.literal("")),
  role: z.string().min(1, "Role is required"),
  organizationId: z.string().uuid().optional(),
});

// Validation helper functions
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const result = emailSchema.safeParse(email);
  return result.success
    ? { valid: true }
    : { valid: false, error: result.error.errors[0]?.message };
};

export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  const result = passwordSchema.safeParse(password);
  return result.success
    ? { valid: true }
    : { valid: false, error: result.error.errors[0]?.message };
};

// Sanitize input to prevent XSS
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .trim();
};

// Rate limiting helper (client-side)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remainingAttempts: number; resetIn: number } => {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remainingAttempts: maxAttempts - 1, resetIn: windowMs };
  }

  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetIn: record.resetTime - now,
    };
  }

  record.count++;
  return {
    allowed: true,
    remainingAttempts: maxAttempts - record.count,
    resetIn: record.resetTime - now,
  };
};

export const resetRateLimit = (key: string): void => {
  rateLimitMap.delete(key);
};
