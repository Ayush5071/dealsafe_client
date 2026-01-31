/**
 * Role-Specific Context Questions
 * Defines what information to collect from each user role
 */

export const ROLE_CONTEXTS = {
    Freelancer: {
        title: 'Project Context',
        description: 'Help us understand your project to provide better recommendations',
        questions: [
            {
                id: 'projectBudget',
                label: 'Project Budget/Payment',
                type: 'number',
                placeholder: 'e.g., 5000',
                prefix: '$',
                required: false,
                helpText: 'Total project value or your rate'
            },
            {
                id: 'projectDuration',
                label: 'Project Duration',
                type: 'select',
                options: ['< 1 month', '1-3 months', '3-6 months', '6+ months', 'Ongoing'],
                required: false
            },
            {
                id: 'clientType',
                label: 'Client Type',
                type: 'select',
                options: ['New client', 'Existing client', 'Agency', 'Direct company'],
                required: false
            },
            {
                id: 'currentWorkload',
                label: 'Your Current Workload',
                type: 'select',
                options: ['Light (can take more)', 'Medium (manageable)', 'Heavy (at capacity)', 'Overloaded'],
                required: false
            },
            {
                id: 'paymentPreference',
                label: 'Preferred Payment Terms',
                type: 'select',
                options: ['Upfront payment', 'Milestone-based', 'Upon completion', 'Monthly retainer'],
                required: false
            },
            {
                id: 'experienceLevel',
                label: 'Your Experience in This Field',
                type: 'select',
                options: ['Beginner (< 1 year)', 'Intermediate (1-3 years)', 'Advanced (3-5 years)', 'Expert (5+ years)'],
                required: false
            }
        ]
    },

    Agency: {
        title: 'Freelancer Evaluation Context',
        description: 'Provide details to help evaluate this freelancer contract',
        questions: [
            {
                id: 'freelancerExperience',
                label: 'Freelancer Experience Level',
                type: 'select',
                options: ['Junior', 'Mid-level', 'Senior', 'Expert'],
                required: false
            },
            {
                id: 'projectComplexity',
                label: 'Project Complexity',
                type: 'select',
                options: ['Simple', 'Moderate', 'Complex', 'Highly Complex'],
                required: false
            },
            {
                id: 'budgetAllocated',
                label: 'Budget Allocated',
                type: 'number',
                placeholder: 'e.g., 10000',
                prefix: '$',
                required: false
            },
            {
                id: 'timeline',
                label: 'Project Timeline',
                type: 'select',
                options: ['Urgent (< 2 weeks)', 'Normal (2-4 weeks)', 'Flexible (1-3 months)', 'Long-term (3+ months)'],
                required: false
            },
            {
                id: 'teamSize',
                label: 'Team Size Needed',
                type: 'select',
                options: ['Solo freelancer', '2-3 people', '4-10 people', 'Large team (10+)'],
                required: false
            }
        ]
    },

    'Corporate Employee': {
        title: 'Job Offer Context',
        description: 'Share your situation to get personalized offer evaluation',
        questions: [
            {
                id: 'currentSalary',
                label: 'Current Salary (Optional)',
                type: 'number',
                placeholder: 'e.g., 80000',
                prefix: '$',
                required: false,
                helpText: 'Helps compare with the offer'
            },
            {
                id: 'yearsExperience',
                label: 'Years of Experience',
                type: 'number',
                placeholder: 'e.g., 5',
                required: false
            },
            {
                id: 'industryStandard',
                label: 'Know Industry Standard for This Role?',
                type: 'select',
                options: ['Yes, above average', 'Yes, average', 'Yes, below average', 'Not sure'],
                required: false
            },
            {
                id: 'workLocation',
                label: 'Work Location Preference',
                type: 'select',
                options: ['Remote', 'Hybrid', 'On-site', 'Flexible'],
                required: false
            },
            {
                id: 'careerGoals',
                label: 'Primary Career Goal',
                type: 'select',
                options: ['Higher salary', 'Better work-life balance', 'Career growth', 'Learning opportunities', 'Job security'],
                required: false
            }
        ]
    },

    HR: {
        title: 'Candidate Hiring Context',
        description: 'Provide hiring context for better contract evaluation',
        questions: [
            {
                id: 'positionLevel',
                label: 'Position Level',
                type: 'select',
                options: ['Entry-level', 'Mid-level', 'Senior', 'Lead/Principal', 'Executive'],
                required: false
            },
            {
                id: 'budgetRange',
                label: 'Budget Range',
                type: 'text',
                placeholder: 'e.g., $80k - $100k',
                required: false
            },
            {
                id: 'marketRate',
                label: 'Market Rate for This Role',
                type: 'select',
                options: ['Below market', 'At market', 'Above market', 'Premium'],
                required: false
            },
            {
                id: 'candidateExperience',
                label: 'Candidate Experience',
                type: 'number',
                placeholder: 'Years of experience',
                required: false
            },
            {
                id: 'urgency',
                label: 'Urgency to Fill Position',
                type: 'select',
                options: ['Critical (ASAP)', 'High (2-4 weeks)', 'Normal (1-2 months)', 'Low (flexible)'],
                required: false
            }
        ]
    },

    Recruiter: {
        title: 'Recruitment Context',
        description: 'Context for evaluating candidate contract',
        questions: [
            {
                id: 'clientBudget',
                label: 'Client Budget',
                type: 'number',
                placeholder: 'e.g., 100000',
                prefix: '$',
                required: false
            },
            {
                id: 'candidateExpectation',
                label: 'Candidate Salary Expectation',
                type: 'number',
                placeholder: 'e.g., 95000',
                prefix: '$',
                required: false
            },
            {
                id: 'roleType',
                label: 'Role Type',
                type: 'select',
                options: ['Permanent', 'Contract', 'Contract-to-hire', 'Temporary'],
                required: false
            },
            {
                id: 'candidateQuality',
                label: 'Candidate Quality',
                type: 'select',
                options: ['Excellent fit', 'Good fit', 'Acceptable', 'Marginal'],
                required: false
            }
        ]
    }
};

export function getQuestionsForRole(role) {
    return ROLE_CONTEXTS[role] || ROLE_CONTEXTS['Freelancer'];
}
