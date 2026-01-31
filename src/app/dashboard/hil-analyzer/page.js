"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function HILAnalyzerPage() {
  const { data: session } = useSession();
  const [file, setFile] = useState(null);
  const [analysisType, setAnalysisType] = useState('contract');
  const [analysisMode, setAnalysisMode] = useState('feedback-driven');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState(null);
  const [isExpert, setIsExpert] = useState(false);

  useEffect(() => {
    async function fetchRole() {
      if (!session?.user?.email) return;
      try {
        const res = await fetch('/api/user/role');
        if (!res.ok) return;
        const json = await res.json();
        setRole(json.role);
        setIsExpert(json.isExpert || false);
      } catch (err) {
        console.error('Error fetching role', err);
      }
    }
    fetchRole();
  }, [session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a document to analyze");
      return;
    }

    if (!isExpert) {
      setError("HIL Analyzer is only available to expert users");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('analysisType', analysisType);
      formData.append('analysisMode', analysisMode);
      formData.append('role', role);

      const res = await fetch('/api/hil-analyzer', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setError("");
    setResult(null);
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type !== 'application/pdf') {
      setError("Please select a PDF file");
      return;
    }
    setFile(selectedFile);
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <p className="text-zinc-400">Please sign in to access HIL Analyzer.</p>
        </div>
      </div>
    );
  }

  if (!isExpert) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4 text-white">Access Restricted</h2>
          <p className="text-zinc-400">HIL Analyzer is only available to expert users. Contact an administrator to get expert privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Human-in-the-Loop Analyzer</h1>
        <p className="text-zinc-400">
          Advanced document analysis that leverages human expert feedback to continuously improve the AI system. 
          This analyzer focuses on training the vector store and fine-tuning LLM responses based on expert reviews.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 sticky top-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Upload Document
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Analysis Type
                </label>
                <select
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value)}
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                >
                  <option value="contract">Contract Analysis</option>
                  <option value="offer-letter">Offer Letter Review</option>
                  <option value="legal-document">Legal Document</option>
                  <option value="compliance">Compliance Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Analysis Mode
                </label>
                <select
                  value={analysisMode}
                  onChange={(e) => setAnalysisMode(e.target.value)}
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                >
                  <option value="feedback-driven">Feedback-Driven Learning</option>
                  <option value="vector-training">Vector Store Training</option>
                  <option value="llm-tuning">LLM Fine-tuning</option>
                  <option value="hybrid">Hybrid Approach</option>
                </select>
              </div>

              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <p className="text-sm text-zinc-300 mb-2">
                  <strong>Role:</strong> {role || 'Not set'}
                </p>
                <p className="text-sm text-zinc-300">
                  <strong>Expert Status:</strong> {isExpert ? 'Active' : 'Inactive'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !file}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
              >
                {loading ? 'Analyzing & Learning...' : 'Start HIL Analysis'}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {loading && (
            <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-zinc-400">
                Performing human-in-the-loop analysis and updating training data...
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Analysis Results */}
              <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
                <h3 className="text-xl font-semibold text-white mb-4">HIL Analysis Results</h3>
                
                {result.initial_analysis && (
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-white mb-3">Initial AI Analysis</h4>
                    <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                      <p className="text-zinc-300 text-sm mb-2">
                        <strong>Risk Score:</strong> {result.initial_analysis.risk_score}/100
                      </p>
                      <p className="text-zinc-300 text-sm mb-2">
                        <strong>Confidence:</strong> {result.initial_analysis.confidence}%
                      </p>
                      <div className="text-zinc-300 text-sm">
                        <strong>Key Insights:</strong>
                        <ul className="mt-2 space-y-1">
                          {result.initial_analysis.key_insights?.map((insight, index) => (
                            <li key={index} className="text-zinc-400">• {insight}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {result.feedback_prompted && (
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-white mb-3">Expert Feedback Requested</h4>
                    <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                      <p className="text-yellow-200">
                        Expert feedback has been requested for this analysis. The system will learn from your review 
                        and use it to improve future analyses.
                      </p>
                    </div>
                  </div>
                )}

                {result.training_impact && (
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-white mb-3">Training Impact</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                        <p className="text-sm text-zinc-300 mb-1">Vector Store Updates</p>
                        <p className="text-lg font-semibold text-green-400">
                          +{result.training_impact.vectors_added || 0} embeddings
                        </p>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                        <p className="text-sm text-zinc-300 mb-1">Feedback Records</p>
                        <p className="text-lg font-semibold text-blue-400">
                          {result.training_impact.feedback_records || 0} created
                        </p>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                        <p className="text-sm text-zinc-300 mb-1">Training Quality</p>
                        <p className="text-lg font-semibold text-purple-400">
                          {result.training_impact.training_value || 'medium'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {result.hil_context && (
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-white mb-3">HIL Training Context</h4>
                    <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                      <p className="text-zinc-300 text-sm mb-2">
                        <strong>Training Examples Used:</strong> {result.hil_context.training_examples_count}
                      </p>
                      <p className="text-zinc-300 text-sm mb-2">
                        <strong>Role-Specific Training:</strong> {result.hil_context.has_role_match ? 'Available' : 'Limited'}
                      </p>
                      {result.hil_context.training_examples_count > 0 && (
                        <p className="text-zinc-400 text-sm">
                          This analysis leveraged insights from similar documents reviewed by experts.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {result.training_quality && (
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-white mb-3">Training Quality Assessment</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                        <p className="text-sm text-zinc-300 mb-1">Quality Score</p>
                        <p className="text-lg font-semibold text-yellow-400">
                          {Math.round(result.training_quality.quality_score || 0)}/100
                        </p>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                        <p className="text-sm text-zinc-300 mb-1">Completeness</p>
                        <p className="text-lg font-semibold text-orange-400">
                          {Math.round(result.training_quality.completeness || 0)}%
                        </p>
                      </div>
                    </div>
                    {result.training_quality.improvement_suggestions?.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-zinc-300 mb-2"><strong>Training Improvement Suggestions:</strong></p>
                        <ul className="space-y-1">
                          {result.training_quality.improvement_suggestions.map((suggestion, index) => (
                            <li key={index} className="text-zinc-400 text-sm">• {suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {result.learning_opportunities && (
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-white mb-3">Learning Opportunities</h4>
                    <div className="space-y-2">
                      {result.learning_opportunities.map((opportunity, index) => (
                        <div key={index} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                          <p className="text-zinc-300 text-sm">{opportunity}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.feedback_id && (
                  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                    <p className="text-blue-200 text-sm">
                      <strong>Feedback ID:</strong> {result.feedback_id}
                    </p>
                    <p className="text-blue-200 text-sm mt-1">
                      This analysis is now part of the training pipeline and will help improve future predictions.
                    </p>
                  </div>
                )}
              </div>

              {/* Raw Analysis Data */}
              {result.raw && (
                <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
                  <h4 className="text-lg font-medium text-white mb-3">Detailed Analysis</h4>
                  <pre className="text-xs text-zinc-300 bg-zinc-800 p-4 rounded-lg overflow-auto max-h-96">
                    {JSON.stringify(result.raw, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {!loading && !result && (
            <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 text-center">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-xl font-semibold text-white mb-2">HIL Analyzer Ready</h3>
              <p className="text-zinc-400">
                Upload a document to start human-in-the-loop analysis and contribute to AI training.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}