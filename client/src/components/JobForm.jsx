import { useState, useEffect } from "react";

const JobForm = ({ onSubmit, editingJob, onCancel, errorMessage = '' }) => {
    const [form, setForm] = useState({
        title: '',
        description: '',
        location: '',
        salary: '',
        jobType: 'full-time',
        workplace: 'onsite',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (editingJob) {
            setForm({
                title: editingJob.title || '',
                description: editingJob.description || '',
                location: editingJob.location || '',
                salary: editingJob.salary || '',
                jobType: editingJob.jobType || editingJob.Type || 'full-time',
                workplace: editingJob.workplace || 'onsite',
            });
        }
    }, [editingJob]);

    const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            await onSubmit(form);
            if (!editingJob) {
                setForm({ title: '', description: '', location: '', salary: '', jobType: 'full-time', workplace: 'onsite' });
}
        } catch (error) {
            console.error('Error submitting job:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Job Title */}
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                </label>
                <input
                    id="title"
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g., Senior Software Engineer"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                    required
                />
            </div>

            {/* Job Description */}
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Job Description *
                </label>
                <textarea
                    id="description"
                    name="description"
                    rows="4"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe the role, responsibilities, and requirements..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 resize-none"
                    required
                />
            </div>

            {/* Location and Salary Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                        Location *
                    </label>
                    <input
                        id="location"
                        name="location"
                        type="text"
                        value={form.location}
                        onChange={handleChange}
                        placeholder="e.g., Nairobi, Kenya"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="salary" className="block text-sm font-medium text-gray-700 mb-2">
                        Salary (KSH) *
                    </label>
                    <input
                        id="salary"
                        name="salary"
                        type="number"
                        value={form.salary}
                        onChange={handleChange}
                        placeholder="e.g., 50000"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                        required
                    />
                </div>
            </div>

            {/* Job Type */}
            <div>
                <label htmlFor="jobType" className="block text-sm font-medium text-gray-700 mb-2">
                    Job Type *
                </label>
                <select
                    id="jobType"
                    name="jobType"
                    value={form.jobType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                    required
                >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                    <option value="freelance">Freelance</option>
                </select>
            </div>

            <div>
                <label htmlFor="workplace" className="block text-sm font-medium text-gray-700 mb-2">
                    Workplace *
                </label>
                <select
                    id="workplace"
                    name="workplace"
                    value={form.workplace}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                    required
                >
                    <option value="onsite">On-site</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                </select>
            </div>

            {/* Action Buttons */}
            {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                </div>
            )}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {editingJob ? 'Updating...' : 'Creating...'}
                        </>
                    ) : (
                        <>
                            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            {editingJob ? 'Update Job' : 'Create Job'}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default JobForm;
