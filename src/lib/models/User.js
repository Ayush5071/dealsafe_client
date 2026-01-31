import mongoose from 'mongoose';

const ALLOWED_ROLES = [
  'Freelancer',
  'Agency',
  'Corporate Employee',
  'Employer',
  'Startup Founder',
  'HR Professional',
  'Recruiter',
  'Expert',
];

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  role: { type: String, enum: ALLOWED_ROLES, default: null },
  isAdmin: { type: Boolean, default: false },
  isExpert: { type: Boolean, default: false },
  // Backwards-compatible alias: some places refer to `expert` instead of `isExpert`
  expert: { type: Boolean, default: false },

  // Freelancer fields
  totalEarnings: { type: Number },
  projectsCompleted: { type: Number },
  projectsDescription: { type: String },

  // Common fields
  yearsExperience: { type: Number },

  // Corporate Employee fields
  currentSalary: { type: Number },
  techStack: { type: String },
  currentCompany: { type: String },
  previousCompanies: { type: String },

  // Agency fields
  agencyName: { type: String },
  employeeCount: { type: Number },
  clientsServed: { type: Number },
  servicesOffered: { type: String },

  // Employer fields
  companyName: { type: String },
  industry: { type: String },

  // Startup Founder fields
  startupName: { type: String },
  fundingStage: { type: String },
  teamSize: { type: Number },
  domain: { type: String },

  // HR Professional
  specialization: { type: String },

}, {
  timestamps: true,
});

export default mongoose.models.User || mongoose.model('User', UserSchema);