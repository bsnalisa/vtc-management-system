// Comprehensive Trainee Application Types

export interface SchoolSubject {
  subject_name: string;
  exam_level: string;
  symbol: string;
  points?: number;
}

export interface HostelApplicationData {
  preferred_building?: string;
  preferred_room_type?: string;
  dietary_requirements?: string;
  medical_conditions?: string;
  emergency_contact_for_hostel?: string;
}

export interface ComprehensiveApplicationData {
  // Section A: Photo
  photo_path?: string;
  
  // Section B: Applicant's Particulars
  title?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  national_id: string;
  phone: string;
  nationality: string;
  marital_status?: string;
  address: string;
  region: string;
  postal_address?: string;
  email?: string;
  
  // Section C: Emergency Contact
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  emergency_contact_region?: string;
  emergency_contact_email?: string;
  emergency_contact_town: string;
  
  // Section D: Training Details
  trade_id: string;
  trade_id_choice2?: string;
  preferred_training_mode: string;
  preferred_level: number;
  intake: string;
  academic_year: string;
  
  // Section E: Educational History - Tertiary
  tertiary_institution?: string;
  tertiary_region?: string;
  tertiary_address?: string;
  tertiary_phone?: string;
  tertiary_fax?: string;
  tertiary_exam_year?: number;
  
  // Section F: Educational History - High School
  highest_grade_passed: number;
  school_subjects: SchoolSubject[];
  
  // Section G: Employment Information
  employer_name?: string;
  employer_address?: string;
  employer_phone?: string;
  employer_fax?: string;
  employer_town?: string;
  employer_region?: string;
  employer_position?: string;
  employer_duration?: string;
  employer_email?: string;
  
  // Section H: Financial Assistance
  needs_financial_assistance: boolean;
  
  // Section I: Hostel Accommodation
  needs_hostel_accommodation: boolean;
  hostel_application_data?: HostelApplicationData;
  
  // Section J: Health Particulars
  has_disability: boolean;
  disability_description?: string;
  has_special_needs: boolean;
  special_needs_description?: string;
  has_chronic_diseases: boolean;
  chronic_diseases_description?: string;
  
  // Section K: PPE Sizes
  shoe_size?: string;
  overall_size?: string;
  tshirt_size?: string;
  skirt_trousers_size?: string;
  chef_trouser_size?: string;
  chef_jacket_size?: string;
  
  // Section L: ICT Access
  ict_access: string[];
  
  // Section M: Supporting Documents
  id_document_path?: string;
  school_leaving_cert_path?: string;
  academic_qualifications_path?: string;
  additional_documents_paths?: string[];
  
  // Section N: Declaration
  declaration_accepted: boolean;
  
  // Auto-calculated fields (not submitted by user)
  auto_calculated_points?: number;
  auto_qualification_status?: 'qualified' | 'not_qualified' | 'pending';
  auto_qualification_reasons?: string[];
}

export interface EntryRequirement {
  id: string;
  organization_id: string;
  trade_id: string;
  level: number;
  requirement_name: string;
  min_grade: number;
  min_points: number;
  required_subjects: any[];
  english_symbol: string;
  maths_symbol: string;
  science_symbol?: string;
  prevocational_symbol?: string;
  requires_previous_level: boolean;
  previous_level_required?: number;
  mature_age_entry: boolean;
  mature_min_age: number;
  mature_min_experience_years: number;
  additional_requirements?: string;
  active: boolean;
  trades?: { name: string; code: string };
}

export interface QualificationResult {
  qualified: boolean;
  calculated_points: number;
  reasons: string[];
  age_years: number;
  is_mature_age: boolean;
}

export const EXAM_LEVELS = [
  // GCE
  { value: 'GCE_A_LEVEL', label: 'GCE A-Level' },
  { value: 'GCE_AS', label: 'GCE AS Level' },
  { value: 'GCE_O_LEVEL', label: 'GCE O-Level' },
  // IB
  { value: 'IB_HL', label: 'IB Higher Level (HL)' },
  { value: 'IB_SL', label: 'IB Standard Level (SL)' },
  // NSSC (Namibia)
  { value: 'NSSC_AS', label: 'NSSC AS (Advanced Subsidiary)' },
  { value: 'NSSCH', label: 'NSSC Higher (NSSCH)' },
  { value: 'NSSCO', label: 'NSSC Ordinary (NSSCO)' },
  // Cambridge
  { value: 'HIGCSE', label: 'HIGCSE (Higher IGCSE)' },
  { value: 'IGCSE', label: 'IGCSE (Cambridge)' },
  // Senior Certificate (South Africa)
  { value: 'NSC_HG', label: 'NSC Higher Grade (HG)' },
  { value: 'NSC_SG', label: 'NSC Standard Grade (SG)' },
];

// Symbols per exam level
export const SYMBOLS_BY_LEVEL: Record<string, string[]> = {
  'GCE_A_LEVEL': ['A', 'B', 'C', 'D', 'E', 'U'],
  'GCE_AS': ['a', 'b', 'c', 'd', 'e', 'u'],
  'GCE_O_LEVEL': ['A/1', 'B/2', 'C/3', 'D/4', 'E/5', 'F/6', 'G/7', 'U'],
  'IB_HL': ['7', '6', '5', '4', '3', '2', '1'],
  'IB_SL': ['7', '6', '5', '4', '3', '2', '1'],
  'NSSC_AS': ['a', 'b', 'c', 'd', 'e', 'f'],
  'NSSCH': ['1', '2', '3', '4', '5', '6', '7'],
  'NSSCO': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  'HIGCSE': ['1', '2', '3', '4', '5', '6', '7'],
  'IGCSE': ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U'],
  'NSC_HG': ['A [80-100]', 'B [70-79]', 'C [60-69]', 'D [50-59]', 'E [40-49]', 'F [33.3-39]'],
  'NSC_SG': ['A [80-100]', 'B [70-79]', 'C [60-69]', 'D [50-59]', 'E [40-49]', 'F [33.3-39]'],
};

// Default symbols (fallback)
export const SYMBOLS = ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U'];

export const TITLES = ['Mr', 'Ms', 'Mrs', 'Miss', 'Dr', 'Prof'];

export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];

export const ICT_ACCESS_OPTIONS = ['Computer', 'Cellphone', 'Internet', 'Tablet', 'Laptop'];

export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'];
