"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ExpertReviewPage() {
  const { data: session } = useSession();
  const [pendingReviews, setPendingReviews] = useState([]);
  const [userFeedbacks, setUserFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState({
    overallRating: 3,
    accuracyScore: 5,
    comments: '',
    suggestions: '',
    additionalRisks: '',
    additionalBenefits: '',
    status: 'pending'
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const feedbackId = params.get('feedbackId');
    fetchData(feedbackId);
  }, []);

  async function fetchData(feedbackId) {
    setLoading(true);
    try {
      const pendingUrl = feedbackId ? `/api/expert/pending-reviews?feedbackId=${encodeURIComponent(feedbackId)}` : '/api/expert/pending-reviews';
      const [pendingRes, feedbackRes] = await Promise.all([
        fetch(pendingUrl),
        fetch('/api/expert/feedback')
      ]);
      
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingReviews(data.reviews || []);
        if (feedbackId && data.reviews && data.reviews.length) {
          // Auto-open modal for requested review
          openFeedbackModal(data.reviews[0]);
        }
      }
      
      if (feedbackRes.ok) {
        const data = await feedbackRes.json();
        setUserFeedbacks(data.feedbacks || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const [pendingRes, feedbackRes] = await Promise.all([
        fetch('/api/expert/pending-reviews'),
        fetch('/api/expert/feedback')
      ]);
      
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingReviews(data.reviews || []);
      }
      
      if (feedbackRes.ok) {
        const data = await feedbackRes.json();
        setUserFeedbacks(data.feedbacks || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openFeedbackModal(review) {
    setSelectedReview(review);
    setShowFeedbackModal(true);
    setFeedback({
      overallRating: 3,
      accuracyScore: 5,
      comments: '',
      suggestions: '',
      additionalRisks: '',
      additionalBenefits: '',
      status: 'pending'
    });
  }

  async function submitFeedback() {
    if (!selectedReview) return;

    try {
      const res = await fetch('/api/expert/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: selectedReview.analysisId,
          documentName: selectedReview.documentName,
          userEmail: selectedReview.userEmail,
          originalAnalysis: selectedReview.originalAnalysis,
          overallRating: feedback.overallRating,
          accuracyScore: feedback.accuracyScore,
          comments: feedback.comments,
          suggestions: feedback.suggestions,
          additionalRisks: feedback.additionalRisks.split('\n').filter(r => r.trim()),
          additionalBenefits: feedback.additionalBenefits.split('\n').filter(b => b.trim()),
          status: feedback.status
        })
      });

      if (res.ok) {
        alert('Feedback submitted successfully!');
        setShowFeedbackModal(false);
        setSelectedReview(null);
        fetchData();
      } else {
        const error = await res.json();
        alert('Error: ' + (error.error || 'Failed to submit feedback'));
      }
    } catch (error) {
      console.error('Submit feedback error:', error);
      alert('Failed to submit feedback');
    }
  }

  if (loading) {
    return <div className="text-zinc-400">Loading expert reviews...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Expert Review Dashboard</h1>
      <p className="text-zinc-400 mb-8">
        Review LLM-generated contract analyses and provide expert feedback (Human-in-the-Loop)
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📋 Pending Reviews</h2>
          {pendingReviews.length === 0 ? (
            <p className="text-zinc-400">No pending reviews</p>
          ) : (
            <ul className="space-y-3">
              {pendingReviews.slice(0, 10).map((review) => (
                <li key={review._id} className="border border-zinc-700 rounded p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{review.documentName}</p>
                      <p className="text-sm text-zinc-400">User: {review.userEmail}</p>
                      <p className="text-xs text-zinc-500">
                        {new Date(review.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => openFeedbackModal(review)}
                      className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
                    >
                      Review
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">✅ My Feedback History</h2>
          {userFeedbacks.length === 0 ? (
            <p className="text-zinc-400">No feedback submitted yet</p>
          ) : (
            <ul className="space-y-3">
              {userFeedbacks.slice(0, 10).map((fb) => (
                <li key={fb._id} className="border border-zinc-700 rounded p-3">
                  <p className="font-semibold">{fb.documentName}</p>
                  <p className="text-sm text-zinc-400">
                    Rating: {fb.overallRating}/5 | Accuracy: {fb.accuracyScore}/10
                  </p>
                  <p className="text-xs text-zinc-500">
                    Status: <span className={fb.status === 'approved' ? 'text-green-400' : 'text-yellow-400'}>{fb.status}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && selectedReview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <h2 className="text-2xl font-bold mb-4">Review Analysis</h2>
            <p className="text-zinc-400 mb-4">Document: <strong>{selectedReview.documentName}</strong></p>
            <p className="text-zinc-400 mb-6">User: {selectedReview.userEmail}</p>

            {/* Original Analysis Preview */}
            <div className="bg-zinc-800 border border-zinc-700 rounded p-4 mb-6 max-h-60 overflow-auto">
              <h3 className="font-bold mb-2">Original LLM Analysis:</h3>
              {selectedReview.type === 'chat' ? (
                <div className="text-sm">
                  <div className="font-medium mb-1">Question:</div>
                  <div className="mb-2 text-zinc-300 whitespace-pre-wrap">{selectedReview.originalAnalysis?.question || 'N/A'}</div>
                  <div className="font-medium mb-1">Answer:</div>
                  <div className="mb-2 text-zinc-300 whitespace-pre-wrap">{selectedReview.originalAnalysis?.answer || 'N/A'}</div>
                  {selectedReview.payload?.sources && selectedReview.payload.sources.length > 0 && (
                    <div className="mt-2 text-xs text-zinc-400">
                      <div className="font-medium">Sources:</div>
                      <ul className="list-disc ml-5">
                        {selectedReview.payload.sources.map((s, idx) => (
                          <li key={idx} className="mt-1">{s.source} (page {s.page})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap">{JSON.stringify(selectedReview.originalAnalysis, null, 2)}</pre>
              )}
            </div>

            {/* Feedback Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Overall Rating (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={feedback.overallRating}
                  onChange={(e) => setFeedback({...feedback, overallRating: parseInt(e.target.value)})}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Accuracy Score (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={feedback.accuracyScore}
                  onChange={(e) => setFeedback({...feedback, accuracyScore: parseInt(e.target.value)})}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Comments</label>
                <textarea
                  value={feedback.comments}
                  onChange={(e) => setFeedback({...feedback, comments: e.target.value})}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded h-24"
                  placeholder="Your expert comments on the analysis..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Suggestions for Improvement</label>
                <textarea
                  value={feedback.suggestions}
                  onChange={(e) => setFeedback({...feedback, suggestions: e.target.value})}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded h-24"
                  placeholder="How could the LLM improve this analysis?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Additional Risks (one per line)</label>
                <textarea
                  value={feedback.additionalRisks}
                  onChange={(e) => setFeedback({...feedback, additionalRisks: e.target.value})}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded h-20"
                  placeholder="Risk 1\nRisk 2\nRisk 3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Additional Benefits (one per line)</label>
                <textarea
                  value={feedback.additionalBenefits}
                  onChange={(e) => setFeedback({...feedback, additionalBenefits: e.target.value})}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded h-20"
                  placeholder="Benefit 1\nBenefit 2\nBenefit 3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={feedback.status}
                  onChange={(e) => setFeedback({...feedback, status: e.target.value})}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="needs_revision">Needs Revision</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setSelectedReview(null);
                }}
                className="px-4 py-2 bg-zinc-700 rounded hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
