import mongoose from 'mongoose';

const FeedbackSchema = new mongoose.Schema({
  analysisId: { type: String, required: true, index: true },
  type: { type: String, enum: ['analysis', 'chat', 'upload', 'resume', 'hil_analysis'], default: 'analysis' },
  documentName: { type: String, required: true },
  userEmail: { type: String, required: true },
  expertEmail: { type: String, required: true },
  expertName: { type: String },
  
  // Original LLM analysis or chat payload
  originalAnalysis: { type: mongoose.Schema.Types.Mixed },
  payload: { type: mongoose.Schema.Types.Mixed },
  
  // Expert feedback
  overallRating: { type: Number, min: 1, max: 5 },
  accuracyScore: { type: Number, min: 1, max: 10 },
  comments: { type: String },
  suggestions: { type: String },
  
  // Corrections
  correctedClauses: { type: mongoose.Schema.Types.Mixed },
  additionalRisks: [String],
  additionalBenefits: [String],
  
  // HIL-specific metadata
  metadata: { type: mongoose.Schema.Types.Mixed },
  
  status: { 
    type: String, 
    enum: ['pending', 'pending_expert_review', 'approved', 'needs_revision', 'rejected'],
    default: 'pending'
  },
}, {
  timestamps: true,
});

FeedbackSchema.index({ userEmail: 1, createdAt: -1 });
FeedbackSchema.index({ expertEmail: 1, createdAt: -1 });
FeedbackSchema.index({ status: 1 });

export default mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);
