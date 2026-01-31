"use client";
import { useState } from 'react';

export default function TrainPage() {
  const [file, setFile] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [processingApproval, setProcessingApproval] = useState(false);
  const [rejectionCount, setRejectionCount] = useState(0);
  const [trainingComplete, setTrainingComplete] = useState(false);

  async function analyzeContract() {
    if (!file || !userRole) {
      alert('Please upload a contract and select your role');
      return;
    }

    try {
      setAnalyzing(true);
      setAnalysisResult(null);

      const formData = new FormData();
      formData.append('document', file);
      formData.append('role', userRole);
      formData.append('analysisType', 'contract');
      formData.append('analysisMode', rejectionCount > 0 ? 'learning-enhanced' : 'standard');

      const response = await fetch('/api/hil-analyzer', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      setAnalysisResult(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleApprove() {
    if (!analysisResult) return;

    try {
      setProcessingApproval(true);

      const response = await fetch('/api/hil-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hil_id: analysisResult.feedback_id,
          action: 'approve',
          feedback: {
            comments: `Training approved after ${rejectionCount} iterations`,
            document_text: analysisResult.raw?.document_text || '',
            user_role: userRole,
            apply_to_vector_store: true,
            analysis_preview: analysisResult.raw
          }
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Approval failed');
      }

      setTrainingComplete(true);
      alert(`Training completed! Analysis approved and vectorized after ${rejectionCount + 1} attempts.`);
    } catch (error) {
      console.error('Approval failed:', error);
      alert('Approval failed: ' + error.message);
    } finally {
      setProcessingApproval(false);
    }
  }

  async function handleReject() {
    if (!analysisResult) return;

    try {
      setProcessingApproval(true);
      setRejectionCount(prev => prev + 1);

      const response = await fetch('/api/hil-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hil_id: analysisResult.feedback_id,
          action: 'reject',
          feedback: {
            comments: `Training iteration ${rejectionCount + 1}: Analysis needs improvement`,
            document_text: analysisResult.raw?.document_text || '',
            user_role: userRole,
            request_reanalysis: true
          }
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Rejection failed');
      }

      setAnalysisResult(null);
      // Auto-retry analysis with enhanced learning
      setTimeout(() => analyzeContract(), 1000);
    } catch (error) {
      console.error('Rejection failed:', error);
      alert('Rejection failed: ' + error.message);
      setProcessingApproval(false);
    }
  }

  function resetTraining() {
    setFile(null);
    setUserRole('');
    setAnalysisResult(null);
    setRejectionCount(0);
    setTrainingComplete(false);
  }

  if (trainingComplete) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-400">Training Complete! ✅</h1>
          <p className="text-zinc-300 mt-4">
            Contract analysis has been approved and stored in the training database.
          </p>
          <p className="text-zinc-400 text-sm mt-2">
            Total iterations: {rejectionCount + 1}
          </p>
          <button
            onClick={resetTraining}
            className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Train Another Contract
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contract Training</h1>
        <p className="text-zinc-400">Expert-only training interface for improving contract analysis models</p>
        {rejectionCount > 0 && (
          <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
            <p className="text-yellow-400 text-sm">
              Training iteration #{rejectionCount + 1} - Model learning from previous rejections
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Upload Contract</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Select Contract File
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                disabled={analyzing || processingApproval}
              />
              {file && (
                <p className="text-xs text-zinc-400 mt-1">Selected: {file.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Select User Role
              </label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded text-zinc-100"
                disabled={analyzing || processingApproval}
              >
                <option value="">-- Select Role --</option>
                <option value="Freelancer">Freelancer</option>
                <option value="HR Professional">HR Professional</option>
                <option value="Startup Founder">Startup Founder</option>
                <option value="Corporate Employee">Corporate Employee</option>
                <option value="Agency">Agency</option>
                <option value="Employer">Employer</option>
                <option value="Executive">Executive</option>
              </select>
            </div>

            <button
              onClick={analyzeContract}
              disabled={!file || !userRole || analyzing || processingApproval}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Analyzing Contract...
                </div>
              ) : (
                `Analyze Contract${rejectionCount > 0 ? ` (Iteration ${rejectionCount + 1})` : ''}`
              )}
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Analysis Results</h2>
          
          {!analysisResult && !analyzing && (
            <div className="text-center text-zinc-500 py-8">
              <p>Upload a contract and select your role to begin analysis</p>
            </div>
          )}

          {analyzing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-zinc-400">Analyzing contract using advanced AI models...</p>
              {rejectionCount > 0 && (
                <p className="text-yellow-400 text-sm mt-2">
                  Learning from previous feedback (iteration {rejectionCount + 1})
                </p>
              )}
            </div>
          )}

          {analysisResult && (
            <div className="space-y-4">
              <div className="bg-zinc-800 p-4 rounded">
                <h3 className="font-medium mb-2">Analysis Summary</h3>
                <div className="text-sm text-zinc-300">
                  <p><strong>Risk Score:</strong> {analysisResult.initial_analysis?.risk_score || 'N/A'}</p>
                  <p><strong>Analysis ID:</strong> {analysisResult.analysisId}</p>
                  <p><strong>Training Quality:</strong> {analysisResult.training_impact?.training_value || 'Unknown'}</p>
                </div>
              </div>

              <div className="bg-zinc-800 p-4 rounded max-h-64 overflow-y-auto">
                <h3 className="font-medium mb-2">Full Analysis</h3>
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap">
                  {JSON.stringify(analysisResult.raw, null, 2)}
                </pre>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleApprove}
                  disabled={processingApproval}
                  className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed"
                >
                  {processingApproval ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    'Approve & Store'
                  )}
                </button>
                <button
                  onClick={handleReject}
                  disabled={processingApproval}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed"
                >
                  {processingApproval ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    'Reject & Retry'
                  )}
                </button>
              </div>

              {rejectionCount > 0 && (
                <div className="text-xs text-zinc-400 text-center">
                  Current iteration: {rejectionCount + 1}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}