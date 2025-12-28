import TrendCard from "@/components/dashboard/TrendCard";
import HighlightCard from "@/components/dashboard/HighlightCard";

export default function ManagementDashboardPage() {
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                        Past 30 days meeting trends
                    </h2>
                    <button className="text-indigo-600 font-medium text-sm hover:text-indigo-700">
                        View detailed report
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <TrendCard
                        title="Efficiency Improvement"
                        description="Meeting efficiency improved by 15% compared to last month due to shorter daily stand-ups and better adherence to agendas."
                        percentage="+15%"
                        isPositive={true}
                        tagLabel="POSITIVE GROWTH"
                    />
                    <TrendCard
                        title="Late Starts"
                        description="Late starts increased by 8% specifically within the Engineering department, correlating with back-to-back scheduling."
                        percentage="+8%"
                        isPositive={false}
                        tagLabel="NEGATIVE GROWTH"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <HighlightCard
                        type="positive"
                        title="Highlighted Positive Things"
                        items={[
                            {
                                title: "Agenda Adherence",
                                description:
                                    "Agendas are now attached to 95% of calendar invites.",
                            },
                            {
                                title: "Smaller Meetings",
                                description:
                                    "Significant reduction in meetings with > 10 participants.",
                            },
                            {
                                title: "Better Documentation",
                                description:
                                    "Documentation linking and usage is trending up by 22%.",
                            },
                        ]}
                    />
                    <HighlightCard
                        type="negative"
                        title="Highlighted Negative Things"
                        items={[
                            {
                                title: "Zombie Meetings",
                                description:
                                    "Recurrent meetings without end dates found in Marketing.",
                            },
                            {
                                title: "Low Friday Engagement",
                                description:
                                    "Consistently low engagement scores in late Friday reviews.",
                            },
                            {
                                title: "Context Switching",
                                description:
                                    "High frequency of < 30min gaps between meetings detected.",
                            },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}
