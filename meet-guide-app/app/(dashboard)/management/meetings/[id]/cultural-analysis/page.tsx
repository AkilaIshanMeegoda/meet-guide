import Link from 'next/link';
import React from 'react';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function CulturalAnalysisPage({ params }: PageProps) {
    const resolvedParams = React.use(params);
    const id = resolvedParams.id;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-sm text-gray-500 mb-6 flex items-center">
                <Link href="/management/meetings" className="hover:text-gray-900 transition-colors">
                    All Meetings
                </Link>
                <span className="mx-2">/</span>
                <Link href={`/management/meetings/${id}`} className="hover:text-gray-900 transition-colors">
                    Project Kickoff - Q3
                </Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium">Cultural Analysis</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-8">Meeting Cultural Analysis Overview</h1>

            <div className="space-y-8 text-gray-700">
                <section>
                    <h2 className="text-base font-bold text-gray-900 mb-2">Meeting Summary</h2>
                    <p className="leading-relaxed">
                        This meeting was a kickoff for the Q3 project, involving team members from various departments. The discussion focused on
                        project goals, timelines, and initial task assignments. The overall atmosphere was collaborative, with active participation from
                        most attendees.
                    </p>
                </section>

                <section>
                    <h2 className="text-base font-bold text-gray-900 mb-2">Cultural Strength</h2>
                    <p className="leading-relaxed">
                        The meeting demonstrated a strong sense of collaboration and open communication. Team members actively shared ideas
                        and provided constructive feedback, indicating a culture that values teamwork and diverse perspectives.
                    </p>
                </section>

                <section>
                    <h2 className="text-base font-bold text-gray-900 mb-2">Cultural Risks</h2>
                    <p className="leading-relaxed">
                        There was a slight risk of potential misalignment on project priorities, as some team members seemed to have differing
                        interpretations of the project's key objectives. This could lead to inefficiencies or conflicts later in the project lifecycle.
                    </p>
                </section>

                <section>
                    <h2 className="text-base font-bold text-gray-900 mb-2">Core Cultural Problem</h2>
                    <p className="leading-relaxed">
                        The core cultural problem identified is a lack of shared understanding of project priorities among team members. This stems
                        from insufficient clarity in initial communication and a need for more structured alignment processes.
                    </p>
                </section>

                <section>
                    <h2 className="text-base font-bold text-gray-900 mb-2">Core Cultural Evidence</h2>
                    <p className="leading-relaxed">
                        During the meeting, several team members expressed different views on the project's primary goals. For example, Sarah
                        emphasized customer satisfaction, while David focused on technical innovation, suggesting a divergence in understanding
                        the project's core focus.
                    </p>
                </section>

                <section>
                    <h2 className="text-base font-bold text-gray-900 mb-2">Problem Chain Explanation</h2>
                    <p className="leading-relaxed">
                        The lack of shared understanding of project priorities can lead to misaligned efforts, where team members work towards
                        different objectives. This can result in wasted resources, delays, and ultimately, a project that fails to meet its intended goals.
                        The root cause appears to be inadequate initial communication and a lack of structured alignment processes to ensure
                        everyone is on the same page.
                    </p>
                </section>

                <section>
                    <h2 className="text-base font-bold text-gray-900 mb-2">Recommendation for Management</h2>
                    <p className="leading-relaxed">
                        Management should implement clearer communication strategies for project kickoffs, including detailed project briefs and
                        facilitated alignment workshops. These workshops should focus on defining project goals, clarifying roles and responsibilities,
                        and establishing a shared understanding of success metrics. Regular check-ins and feedback sessions should also be
                        incorporated to monitor alignment and address any emerging discrepancies.
                    </p>
                </section>

                <section>
                    <h2 className="text-base font-bold text-gray-900 mb-2">Evidence Notes</h2>
                    <p className="leading-relaxed">
                        Meeting transcripts and participant feedback indicate a pattern of differing interpretations of project priorities. Specifically,
                        comments from Sarah and David highlight the need for clearer communication and alignment. Further analysis of team
                        interactions and project deliverables could provide additional insights into this issue.
                    </p>
                </section>
            </div>
        </div>
    );
}