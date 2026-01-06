import Link from "next/link";
import React from "react";
import ExportButton from "@/components/ExportButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CulturalAnalysisPage({ params }: PageProps) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-sm text-gray-500 mb-6 flex items-center">
        <Link
          href="/management/meetings"
          className="hover:text-gray-900 transition-colors"
        >
          All Meetings
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/management/meetings/${id}`}
          className="hover:text-gray-900 transition-colors"
        >
          Project Kickoff - Q3
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">Cultural Analysis</span>
      </div>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Meeting Cultural Analysis Overview
        </h1>
        <ExportButton />
      </div>

      <div className="space-y-8 text-gray-700">
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Meeting Summary
          </h2>
          <p className="leading-relaxed">
            This meeting exhibited significant operational dysfunction,
            characterized by poor preparation, unclear purpose, and ineffective
            facilitation. The session was derailed by technical issues,
            background disruptions, and confusion about agenda and timing,
            resulting in minimal substantive discussion and no clear outcomes
            despite scheduled time.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Cultural Strength
          </h2>
          <ul className="list-disc list-inside space-y-1 leading-relaxed">
            <li>One participant consistently voiced concerns about meeting effectiveness and timing, suggesting some level of psychological safety for raising process issues</li>
            <li>Participants demonstrated familiarity with each other and ongoing projects, indicating regular interaction</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Cultural Risks
          </h2>
          <ul className="list-disc list-inside space-y-1 leading-relaxed">
            <li>Severe lack of meeting preparation and unclear facilitation role led to wasted time and confusion</li>
            <li>Meeting purpose was ambiguous (re-used invite with wrong title, confusion about quarterly timing)</li>
            <li>Multiple disruptive elements (technical issues, background noise, late arrival, unidentified caller) were not effectively managed</li>
            <li>No clear decision-making process or documentation of outcomes</li>
            <li>Participant time was not respected (reading numbers aloud inefficiently, ignoring hard stop constraints)</li>
            <li>Project ownership confusion surfaced mid-meeting, suggesting poor pre-meeting alignment</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Core Cultural Problem
          </h2>
          <p className="leading-relaxed">
            Ineffective meeting facilitation combined with inadequate preparation and unclear purpose.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Core Cultural Evidence
          </h2>
          <ul className="list-disc list-inside space-y-1 leading-relaxed">
            <li>Facilitator spent first 4 minutes troubleshooting audio and waiting for participant who was already present</li>
            <li>Screen sharing failed and facilitator resorted to reading spreadsheet numbers aloud for over 10 minutes</li>
            <li>Meeting invite had incorrect title and no clear agenda, causing participant confusion about purpose</li>
            <li>Facilitator dismissed participant concerns about timing and relevance rather than addressing them</li>
            <li>No structure to manage time, disruptions, or keep discussion on track</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Problem Chain Explanation
          </h2>
          <p className="leading-relaxed">
            Inadequate preparation and unclear facilitation created an environment where the meeting purpose was ambiguous from the start. This led to technical and operational inefficiencies wasting valuable time. Without clear structure, disruptive elements (background noise, late arrivals) further derailed progress. The lack of effective process prevented substantive discussion or decision-making, causing participant frustration and requiring additional follow-up meetings, perpetuating a cycle of meeting inefficiency.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Recommendation for Management
          </h2>
          <ul className="list-disc list-inside space-y-1 leading-relaxed">
            <li>Establish mandatory meeting preparation standards: require agendas with clear objectives distributed 24 hours in advance</li>
            <li>Implement facilitator training or assign rotating facilitator role to ensure someone is prepared to manage technology, time, and participation</li>
            <li>Create and enforce meeting participation norms including muting policies, minimizing background distractions, and protocols for late arrivals</li>
            <li>Clarify project ownership and pre-align on topics before scheduling meetings to avoid mid-meeting confusion</li>
            <li>Adopt a decision-making protocol that documents outcomes and next steps before meeting conclusion</li>
            <li>Audit recurring meetings to ensure they have clear purpose and necessary participants, canceling those that don't meet criteria</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Evidence Notes
          </h2>
          <ul className="list-disc list-inside space-y-1 leading-relaxed">
            <li>Facilitator acknowledged re-using old calendar invite with incorrect meeting title</li>
            <li>Participant explicitly stated confusion about meeting purpose and quarterly focus</li>
            <li>Technical issues persisted for over 5 minutes without resolution</li>
            <li>One participant announced a hard stop that was not accommodated in the meeting plan</li>
            <li>Project ownership dispute surfaced between two participants mid-meeting</li>
            <li>Unidentified caller created multiple disruptive audio incidents without being removed</li>
            <li>Meeting concluded with no documented decisions and a frustrated participant</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Limitations
          </h2>
          <p className="leading-relaxed">
            This analysis is based on a single meeting transcript, making it difficult to determine whether these patterns represent systemic cultural issues or an isolated incident. Organizational hierarchy, formal roles, and existing meeting policies are not visible in the data. The identity and context of the disruptive unknown caller remains unclear, limiting assessment of whether this was a preventable issue.
          </p>
        </section>
      </div>
    </div>
  );
}
