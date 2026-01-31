"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ExpertReviewPage() {
  const { data: session } = useSession();
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState({
    rating: 4,
    accuracyScore: 8,
    comments: '',
    suggestions: '',
    additionalRisks: '',
    additionalBenefits: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hil-review');
      if (!res.ok) throw new Error('Failed to fetch reviews');
      const data = await res.json();
      setPendingReviews(data.pending_reviews || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (hilId, action) => {
    try {
      setSubmitting(true);
      
      const feedback = {
        rating: reviewFeedback.rating,
        accuracyScore: reviewFeedback.accuracyScore,
        comments: reviewFeedback.comments,
        suggestions: reviewFeedback.suggestions,
        additionalRisks: reviewFeedback.additionalRisks.split(',').map(r => r.trim()).filter(Boolean),
        additionalBenefits: reviewFeedback.additionalBenefits.split(',').map(b => b.trim()).filter(Boolean)
      };
      
      const res = await fetch('/api/hil-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hil_id: hilId,
          action,
          feedback
        })
      });
      
      if (!res.ok) throw new Error('Failed to submit review');
      
      // Refresh pending reviews
      await fetchPendingReviews();
      setSelectedReview(null);
      setReviewFeedback({
        rating: 4,
        accuracyScore: 8,
        comments: '',
        suggestions: '',
        additionalRisks: '',
        additionalBenefits: ''
      });
      
      alert(`Analysis ${action}d successfully!`);
      
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Failed to submit review: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading pending reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Expert Review Dashboard</h1>
        <p className="text-zinc-400">
          Review AI analyses before they're shown to users. All analyses require expert approval.
        </p>
        <div className="mt-4 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <p className="text-blue-200 text-sm">
            <strong>Mandatory HIL:</strong> Every analysis is now reviewed by experts before reaching users. 
            Your feedback trains the AI system for better future results.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Reviews List */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-xl font-semibold text-white">
              Pending Reviews ({pendingReviews.length})
            </h2>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {pendingReviews.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-zinc-400">No pending reviews</p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {pendingReviews.map((review) => (
                  <div
                    key={review.hil_id}
                    onClick={() => setSelectedReview(review)}
                    className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                      selectedReview?.hil_id === review.hil_id
                        ? 'bg-blue-900/50 border-blue-700'
                        : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-white text-sm">
                        {review.document_name}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        review.priority === 'high' ? 'bg-red-900/50 text-red-200' :
                        review.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-200' :
                        'bg-green-900/50 text-green-200'
                      }`}>
                        {review.priority}
                      </span>
                    </div>
                    
                    <p className="text-zinc-400 text-xs mb-2">
                      Type: {review.type.replace('hil_', '').toUpperCase()}
                    </p>
                    
                    <p className="text-zinc-400 text-xs mb-2">
                      User: {review.user_email}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{new Date(review.created_at).toLocaleString()}</span>
                      {review.re_analysis_count > 0 && (
                        <span className="text-orange-400">
                          Re-analysis #{review.re_analysis_count}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Review Details */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          {selectedReview ? (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {selectedReview.document_name}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <p className="text-zinc-300">
                    <strong>Type:</strong> {selectedReview.type.replace('hil_', '')}
                  </p>
                  <p className="text-zinc-300">
                    <strong>User:</strong> {selectedReview.user_email}
                  </p>
                  <p className="text-zinc-300">
                    <strong>Created:</strong> {new Date(selectedReview.created_at).toLocaleString()}
                  </p>
                  <p className="text-zinc-300">
                    <strong>Re-analysis:</strong> #{selectedReview.re_analysis_count}
                  </p>
                </div>
              </div>

              {/* Analysis Details */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-white mb-3">AI Analysis</h4>
                <div className="bg-zinc-800 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap">
                    {JSON.stringify(selectedReview.analysis, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Expert Feedback Form */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-white">Expert Review</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-1">Overall Rating</label>
                    <select
                      value={reviewFeedback.rating}
                      onChange={(e) => setReviewFeedback({...reviewFeedback, rating: parseInt(e.target.value)})}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                    >
                      {[1,2,3,4,5].map(n => (
                        <option key={n} value={n}>{n} - {n <= 2 ? 'Poor' : n <= 3 ? 'Fair' : n <= 4 ? 'Good' : 'Excellent'}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-zinc-300 mb-1">Accuracy Score</label>
                    <select
                      value={reviewFeedback.accuracyScore}
                      onChange={(e) => setReviewFeedback({...reviewFeedback, accuracyScore: parseInt(e.target.value)})}
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                    >
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <option key={n} value={n}>{n}/10</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-1">Comments</label>
                  <textarea
                    value={reviewFeedback.comments}
                    onChange={(e) => setReviewFeedback({...reviewFeedback, comments: e.target.value})}
                    className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                    rows="3"
                    placeholder="Detailed feedback on the analysis..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-1">Suggestions</label>
                  <textarea
                    value={reviewFeedback.suggestions}
                    onChange={(e) => setReviewFeedback({...reviewFeedback, suggestions: e.target.value})}
                    className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                    rows="3"
                    placeholder="Specific improvements for future analyses..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-1">Additional Risks (comma-separated)</label>
                  <input
                    type="text"
                    value={reviewFeedback.additionalRisks}
                    onChange={(e) => setReviewFeedback({...reviewFeedback, additionalRisks: e.target.value})}
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                    placeholder="Risk 1, Risk 2, Risk 3..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-1">Additional Benefits (comma-separated)</label>
                  <input
                    type="text"
                    value={reviewFeedback.additionalBenefits}
                    onChange={(e) => setReviewFeedback({...reviewFeedback, additionalBenefits: e.target.value})}
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                    placeholder="Benefit 1, Benefit 2, Benefit 3..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleReview(selectedReview.hil_id, 'approve')}
                    disabled={submitting}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-medium py-2 px-4 rounded transition-colors"
                  >
                    {submitting ? 'Processing...' : 'Approve & Release'}
                  </button>
                  
                  <button
                    onClick={() => handleReview(selectedReview.hil_id, 'reject')}
                    disabled={submitting}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-medium py-2 px-4 rounded transition-colors"
                  >
                    {submitting ? 'Processing...' : 'Reject & Request Re-analysis'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-white mb-2">Select a Review</h3>
              <p className="text-zinc-400">
                Choose a pending analysis from the list to review and provide feedback.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}