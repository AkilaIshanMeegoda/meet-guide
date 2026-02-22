"""
Sample Script: Create Test Data and Process Hybrid Detection

This script demonstrates how to:
1. Create sample transcript files
2. Call the hybrid detection API
3. View results

Note: This requires the FastAPI backend to be running
"""
import asyncio
import json
from pathlib import Path
from app.services.hybrid_detection_service import HybridDetectionService


# Sample transcripts for testing
SAMPLE_TRANSCRIPTS = {
    "professional_user": """
Good morning everyone.
I would like to discuss our quarterly objectives.
Our team has made significant progress on the project.
The financial projections look very promising.
I recommend we proceed with the implementation plan.
Our stakeholders have expressed strong support for this initiative.
Let's schedule a follow-up meeting for next week.
""",
    
    "casual_user": """
Yo, what's up team.
This project is fire, no cap.
We totally crushed it last quarter.
The numbers are looking solid, fr fr.
I'm vibing with this new strategy.
Our stakeholders are gonna be shook when they see this.
Let's link up next week to discuss.
""",
    
    "mixed_user": """
Hey everyone, hope you're doing well.
I wanted to share some updates on our progress.
The results are actually pretty fire this quarter.
We've hit all our major milestones.
Our approach has been working really well.
Some of the feedback we got was mid, but overall positive.
Looking forward to continuing this momentum.
"""
}


async def create_sample_transcripts(output_dir: Path):
    """Create sample transcript files for testing"""
    print("\n" + "="*60)
    print("Creating Sample Transcript Files")
    print("="*60)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for user_name, transcript in SAMPLE_TRANSCRIPTS.items():
        file_path = output_dir / f"{user_name}.txt"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(transcript.strip())
        print(f"✓ Created: {file_path}")
    
    print(f"\n✅ Created {len(SAMPLE_TRANSCRIPTS)} sample transcripts")


async def analyze_sample_transcripts():
    """Analyze sample transcripts and display results"""
    print("\n" + "="*60)
    print("Analyzing Sample Transcripts")
    print("="*60)
    
    results = []
    
    for user_name, transcript in SAMPLE_TRANSCRIPTS.items():
        print(f"\n📊 Analyzing: {user_name}")
        print("-" * 60)
        
        try:
            # Analyze transcript
            participant_info = {
                "id": f"test_{user_name}",
                "name": user_name.replace('_', ' ').title()
            }
            
            meeting_info = {
                "id": "sample_meeting_001"
            }
            
            result = await HybridDetectionService.analyze_transcript(
                transcript=transcript,
                participant_info=participant_info,
                meeting_info=meeting_info
            )
            
            results.append({
                "user_name": user_name,
                "result": result
            })
            
            # Display results
            print(f"   Name: {participant_info['name']}")
            print(f"   Professional Score: {result['professional_score']:.1f}/100")
            print(f"   Score Label: {result['score_label']}")
            print(f"   Total Sentences: {result['total_sentences']}")
            print(f"   Slang Detected: {result['slang_detected']}")
            print(f"   Slang Frequency: {result['slang_frequency_ratio']:.1%}")
            
            # Show detected slang
            slang_terms = []
            for detection in result['detections']:
                if detection['is_slang'] and detection.get('term'):
                    slang_terms.append(detection['term'])
            
            if slang_terms:
                print(f"   Slang Terms: {', '.join(set(slang_terms))}")
            
            # Score breakdown
            if 'breakdown' in result:
                print(f"\n   Score Breakdown:")
                breakdown = result['breakdown']
                print(f"      Base Score: 100")
                if 'frequency_penalty' in breakdown:
                    print(f"      - Frequency Penalty: {breakdown['frequency_penalty']:.2f}")
                if 'severity_penalty' in breakdown:
                    print(f"      - Severity Penalty: {breakdown['severity_penalty']:.2f}")
                if 'repetition_penalty' in breakdown:
                    print(f"      - Repetition Penalty: {breakdown['repetition_penalty']:.2f}")
                if 'confidence_penalty' in breakdown:
                    print(f"      - Confidence Penalty: {breakdown['confidence_penalty']:.2f}")
                if 'engagement_bonus' in breakdown:
                    print(f"      + Engagement Bonus: {breakdown['engagement_bonus']:.2f}")
                print(f"      = Final Score: {result['professional_score']:.2f}")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            import traceback
            traceback.print_exc()
    
    return results


async def compare_results(results):
    """Compare and summarize results"""
    print("\n" + "="*60)
    print("COMPARISON SUMMARY")
    print("="*60)
    
    # Sort by score
    sorted_results = sorted(
        results, 
        key=lambda x: x['result']['professional_score'], 
        reverse=True
    )
    
    print("\n🏆 Ranking by Professional Score:")
    for i, item in enumerate(sorted_results, 1):
        user_name = item['user_name'].replace('_', ' ').title()
        score = item['result']['professional_score']
        label = item['result']['score_label']
        slang = item['result']['slang_detected']
        
        emoji = "🥇" if i == 1 else "🥈" if i == 2 else "🥉"
        print(f"\n{emoji} #{i}: {user_name}")
        print(f"   Score: {score:.1f}/100 ({label})")
        print(f"   Slang Detected: {slang} instances")
    
    # Statistics
    scores = [r['result']['professional_score'] for r in results]
    avg_score = sum(scores) / len(scores)
    
    print(f"\n📈 Statistics:")
    print(f"   Average Score: {avg_score:.1f}")
    print(f"   Highest Score: {max(scores):.1f}")
    print(f"   Lowest Score: {min(scores):.1f}")
    print(f"   Range: {max(scores) - min(scores):.1f}")


async def save_results_json(results, output_file: Path):
    """Save results to JSON file"""
    print(f"\n💾 Saving results to: {output_file}")
    
    # Convert results to JSON-serializable format
    json_results = []
    for item in results:
        json_item = {
            "user_name": item['user_name'],
            "professional_score": item['result']['professional_score'],
            "score_label": item['result']['score_label'],
            "total_sentences": item['result']['total_sentences'],
            "slang_detected": item['result']['slang_detected'],
            "slang_frequency_ratio": item['result']['slang_frequency_ratio'],
            "detections": item['result']['detections']
        }
        json_results.append(json_item)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(json_results, f, indent=2)
    
    print(f"✅ Results saved successfully")


async def main():
    """Main execution"""
    print("\n" + "="*60)
    print("HYBRID DETECTION SAMPLE ANALYSIS")
    print("="*60)
    
    # Setup paths
    base_dir = Path(__file__).parent
    sample_dir = base_dir / "sample_transcripts"
    results_file = base_dir / "sample_results.json"
    
    try:
        # Step 1: Create sample transcripts
        await create_sample_transcripts(sample_dir)
        
        # Step 2: Analyze transcripts
        results = await analyze_sample_transcripts()
        
        if not results:
            print("\n❌ No results generated")
            return
        
        # Step 3: Compare results
        await compare_results(results)
        
        # Step 4: Save results
        await save_results_json(results, results_file)
        
        print("\n" + "="*60)
        print("✅ ANALYSIS COMPLETE")
        print("="*60)
        print(f"\nSample transcripts: {sample_dir}")
        print(f"Results JSON: {results_file}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
