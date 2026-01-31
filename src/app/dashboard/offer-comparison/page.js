"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";

export default function OfferComparisonPage() {
    const { data: session } = useSession();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [reviews, setReviews] = useState(null);
    const [loadingReviews, setLoadingReviews] = useState(false);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length > 4) {
            setError("Maximum 4 offers can be compared at once");
            return;
        }
        setFiles(selectedFiles);
        setError(null);
        setAnalysis(null);
        setReviews(null);
    };

    const handleCompare = async () => {
        if (files.length < 2) {
            setError("Please upload at least 2 offer letters");
            return;
        }

        setLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            const formData = new FormData();
            files.forEach((file) => {
                formData.append("offers", file);
            });

            const res = await fetch("/api/offers/compare", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to compare offers");
            }

            const data = await res.json();
            setAnalysis(data.analysis);

            // Auto-fetch reviews for recommended company
            if (data.analysis?.offers?.length > 0) {
                const recommendedOffer = data.analysis.offers.find(
                    o => o.id === data.analysis.recommendation?.recommendedOfferId
                );
                if (recommendedOffer?.company) {
                    fetchReviews(recommendedOffer.company);
                }
            }
        } catch (err) {
            console.error("Comparison error:", err);
            setError(err.message || "Failed to compare offers");
        } finally {
            setLoading(false);
        }
    };

    const fetchReviews = async (company) => {
        setLoadingReviews(true);
        setSelectedCompany(company);
        try {
            const res = await fetch(`/api/reviews/company?company=${encodeURIComponent(company)}`);
            if (!res.ok) throw new Error("Failed to fetch reviews");
            const data = await res.json();
            setReviews(data);
        } catch (err) {
            console.error("Reviews error:", err);
        } finally {
            setLoadingReviews(false);
        }
    };

    if (!session) {
        return <div className="text-zinc-400">Please sign in to access this feature.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Offer Comparison
                </h1>
                <p className="text-zinc-400">
                    Upload multiple job offer letters and get AI-powered recommendations tailored to your profile
                </p>
            </div>

            {/* Upload Section */}
            <div className="bg-zinc-900 rounded-lg p-6 mb-6 border border-zinc-800">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>📄</span> Upload Offer Letters
                </h2>
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                        <input
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                            id="offer-upload"
                        />
                        <label htmlFor="offer-upload" className="cursor-pointer">
                            <div className="text-4xl mb-3">📎</div>
                            <div className="text-lg font-medium mb-2">Click to upload offer letters</div>
                            <div className="text-sm text-zinc-400">PDF format only • 2-4 offers • Max 10MB each</div>
                        </label>
                    </div>

                    {files.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-zinc-300">Selected Files ({files.length}):</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {files.map((file, idx) => (
                                    <div key={idx} className="bg-zinc-800 rounded p-3 flex items-center gap-3">
                                        <span className="text-2xl">📄</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{file.name}</div>
                                            <div className="text-xs text-zinc-400">{(file.size / 1024).toFixed(1)} KB</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleCompare}
                        disabled={loading || files.length < 2}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin">⚙️</span> Analyzing Offers...
                            </span>
                        ) : (
                            "Compare Offers with AI"
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-200">
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* Analysis Results */}
            {analysis && (
                <>
                    {/* Summary */}
                    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/50 rounded-lg p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                            <span>💡</span> Analysis Summary
                        </h2>
                        <p className="text-zinc-300 leading-relaxed">{analysis.summary}</p>
                    </div>

                    {/* Comparison Table */}
                    <div className="bg-zinc-900 rounded-lg p-6 mb-6 border border-zinc-800 overflow-x-auto">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span>📊</span> Detailed Comparison
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-700">
                                        <th className="py-3 px-4 text-zinc-400 font-medium">Aspect</th>
                                        {analysis.offers?.map((offer) => (
                                            <th key={offer.id} className="py-3 px-4 font-semibold">
                                                <div className="flex items-center gap-2">
                                                    {offer.id === analysis.recommendation?.recommendedOfferId && (
                                                        <span className="text-green-400" title="Recommended">⭐</span>
                                                    )}
                                                    {offer.company}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-zinc-800 hover:bg-zinc-800/50">
                                        <td className="py-3 px-4 text-zinc-400 font-medium">Role</td>
                                        {analysis.offers?.map((offer) => (
                                            <td key={offer.id} className="py-3 px-4">{offer.role || 'N/A'}</td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-zinc-800 hover:bg-zinc-800/50">
                                        <td className="py-3 px-4 text-zinc-400 font-medium">Salary</td>
                                        {analysis.offers?.map((offer) => (
                                            <td key={offer.id} className="py-3 px-4 font-semibold text-green-400">
                                                {offer.salary || 'N/A'}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-zinc-800 hover:bg-zinc-800/50">
                                        <td className="py-3 px-4 text-zinc-400 font-medium">Location</td>
                                        {analysis.offers?.map((offer) => (
                                            <td key={offer.id} className="py-3 px-4">{offer.location || 'N/A'}</td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-zinc-800 hover:bg-zinc-800/50">
                                        <td className="py-3 px-4 text-zinc-400 font-medium">Benefits</td>
                                        {analysis.offers?.map((offer) => (
                                            <td key={offer.id} className="py-3 px-4">
                                                <ul className="text-sm space-y-1">
                                                    {offer.benefits?.slice(0, 3).map((benefit, idx) => (
                                                        <li key={idx} className="text-zinc-300">• {benefit}</li>
                                                    ))}
                                                </ul>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-zinc-800 hover:bg-zinc-800/50">
                                        <td className="py-3 px-4 text-zinc-400 font-medium">Highlights</td>
                                        {analysis.offers?.map((offer) => (
                                            <td key={offer.id} className="py-3 px-4">
                                                <ul className="text-sm space-y-1">
                                                    {offer.highlights?.slice(0, 2).map((highlight, idx) => (
                                                        <li key={idx} className="text-blue-300">✓ {highlight}</li>
                                                    ))}
                                                </ul>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="hover:bg-zinc-800/50">
                                        <td className="py-3 px-4 text-zinc-400 font-medium">Concerns</td>
                                        {analysis.offers?.map((offer) => (
                                            <td key={offer.id} className="py-3 px-4">
                                                <ul className="text-sm space-y-1">
                                                    {offer.concerns?.slice(0, 2).map((concern, idx) => (
                                                        <li key={idx} className="text-orange-300">⚠ {concern}</li>
                                                    ))}
                                                </ul>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Comparison Insights */}
                    {analysis.comparison && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <span>💰</span> Compensation
                                </h3>
                                <p className="text-sm text-zinc-300">{analysis.comparison.compensation}</p>
                            </div>
                            <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <span>📈</span> Growth Potential
                                </h3>
                                <p className="text-sm text-zinc-300">{analysis.comparison.growth}</p>
                            </div>
                            <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <span>⚖️</span> Work-Life Balance
                                </h3>
                                <p className="text-sm text-zinc-300">{analysis.comparison.workLife}</p>
                            </div>
                            <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <span>🏢</span> Company Culture
                                </h3>
                                <p className="text-sm text-zinc-300">{analysis.comparison.culture}</p>
                            </div>
                        </div>
                    )}

                    {/* AI Recommendation */}
                    {analysis.recommendation && (
                        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-800/50 rounded-lg p-6 mb-6">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <span>🎯</span> AI Recommendation
                            </h2>
                            <div className="space-y-4">
                                <div className="bg-black/30 rounded-lg p-4">
                                    <div className="text-sm text-zinc-400 mb-1">Recommended Offer</div>
                                    <div className="text-2xl font-bold text-green-400">
                                        {analysis.offers?.find(o => o.id === analysis.recommendation.recommendedOfferId)?.company || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2 text-zinc-300">Reasoning</h3>
                                    <p className="text-zinc-300 leading-relaxed">{analysis.recommendation.reasoning}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2 text-zinc-300">Key Factors</h3>
                                    <ul className="space-y-2">
                                        {analysis.recommendation.keyFactors?.map((factor, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-zinc-300">
                                                <span className="text-green-400 mt-1">✓</span>
                                                <span>{factor}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
                                    <h3 className="font-semibold mb-2 text-yellow-300">Important Considerations</h3>
                                    <p className="text-sm text-zinc-300">{analysis.recommendation.considerations}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Company Reviews Section */}
                    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span>⭐</span> Company Reviews
                        </h2>

                        {/* Company Selector */}
                        <div className="mb-6">
                            <label className="block text-sm text-zinc-400 mb-2">Select company to view reviews:</label>
                            <div className="flex flex-wrap gap-2">
                                {analysis.offers?.map((offer) => (
                                    <button
                                        key={offer.id}
                                        onClick={() => fetchReviews(offer.company)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedCompany === offer.company
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {offer.company}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reviews Display */}
                        {loadingReviews && (
                            <div className="text-center py-8 text-zinc-400">
                                <span className="animate-spin inline-block">⚙️</span> Loading reviews...
                            </div>
                        )}

                        {reviews && !loadingReviews && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 pb-4 border-b border-zinc-800">
                                    <div className="text-3xl font-bold text-yellow-400">{reviews.averageRating}</div>
                                    <div>
                                        <div className="flex items-center gap-1">
                                            {[...Array(5)].map((_, i) => (
                                                <span key={i} className={i < Math.floor(parseFloat(reviews.averageRating)) ? 'text-yellow-400' : 'text-zinc-600'}>
                                                    ⭐
                                                </span>
                                            ))}
                                        </div>
                                        <div className="text-sm text-zinc-400">{reviews.totalReviews} reviews</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {reviews.reviews?.map((review) => (
                                        <div key={review.id} className="bg-zinc-800/50 rounded-lg p-5 hover:bg-zinc-800 transition-colors">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="flex items-center gap-1">
                                                            {[...Array(5)].map((_, i) => (
                                                                <span key={i} className={`text-sm ${i < Math.floor(review.rating) ? 'text-yellow-400' : 'text-zinc-600'}`}>
                                                                    ⭐
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className="text-sm font-semibold">{review.rating}</span>
                                                    </div>
                                                    <h3 className="font-semibold text-white">{review.title}</h3>
                                                </div>
                                                <span className="text-xs text-zinc-500">{review.date}</span>
                                            </div>
                                            <p className="text-zinc-300 mb-3 leading-relaxed">{review.content}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                <div className="bg-green-900/20 border border-green-800/30 rounded p-3">
                                                    <div className="text-xs font-semibold text-green-400 mb-1">PROS</div>
                                                    <div className="text-sm text-zinc-300">{review.pros}</div>
                                                </div>
                                                <div className="bg-red-900/20 border border-red-800/30 rounded p-3">
                                                    <div className="text-xs font-semibold text-red-400 mb-1">CONS</div>
                                                    <div className="text-sm text-zinc-300">{review.cons}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-zinc-500">
                                                <span className="italic">{review.author}</span>
                                                <span>👍 {review.helpful} found helpful</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
