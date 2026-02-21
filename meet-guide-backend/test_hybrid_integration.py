"""
Test Hybrid Detection Integration

This script tests the hybrid detection system integration by:
1. Initializing the detector
2. Testing sentence analysis
3. Testing professional score calculation
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.hybrid_detection_service import HybridDetectionService


def test_initialization():
    """Test hybrid detector initialization"""
    print("\n" + "="*60)
    print("TEST 1: Initializing Hybrid Detector")
    print("="*60)
    
    try:
        HybridDetectionService.initialize_hybrid_detector()
        print("✅ Hybrid detector initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to initialize: {e}")
        return False


def test_sentence_analysis():
    """Test analyzing individual sentences"""
    print("\n" + "="*60)
    print("TEST 2: Analyzing Sample Sentences")
    print("="*60)
    
    test_sentences = [
        "This is a professional business communication.",
        "That presentation was fire, no cap!",
        "We need to rizz up our marketing strategy.",
        "The quarterly results look solid and promising."
    ]
    
    try:
        HybridDetectionService.initialize_hybrid_detector()
        detector = HybridDetectionService._hybrid_detector
        
        for sentence in test_sentences:
            result = detector.analyze(sentence)
            status = "🔴 SLANG" if result['is_slang'] else "🟢 OK"
            print(f"\n{status} - {sentence}")
            print(f"   Confidence: {result['confidence']:.2f}")
            print(f"   Method: {result['method']}")
            if result['term']:
                print(f"   Term: {result['term']}")
        
        print("\n✅ Sentence analysis test completed")
        return True
        
    except Exception as e:
        print(f"❌ Sentence analysis failed: {e}")
        return False


def test_professional_score():
    """Test professional score calculation"""
    print("\n" + "="*60)
    print("TEST 3: Calculating Professional Score")
    print("="*60)
    
    sample_transcript = """
    Good morning everyone.
    I'd like to present our Q4 results.
    The numbers are looking really solid this quarter.
    We've exceeded our targets by 15 percent.
    Our customer satisfaction rate has improved significantly.
    """
    
    try:
        participant_info = {
            "id": "test_user_001",
            "name": "Test User"
        }
        
        meeting_info = {
            "id": "test_meeting_001"
        }
        
        import asyncio
        result = asyncio.run(HybridDetectionService.analyze_transcript(
            transcript=sample_transcript,
            participant_info=participant_info,
            meeting_info=meeting_info
        ))
        
        # Extract from nested structure
        professionalism = result.get('professionalism', {})
        slang_usage = result.get('slangUsage', {})
        engagement = result.get('engagement', {})
        breakdown = professionalism.get('breakdown', {})
        
        print(f"\n📊 PROFESSIONAL SCORE RESULTS:")
        print(f"   Score: {professionalism.get('score', 0):.2f}/100")
        print(f"   Label: {professionalism.get('label', 'Unknown')}")
        print(f"   Total Sentences: {engagement.get('totalUtterances', 0)}")
        print(f"   Slang Detected: {slang_usage.get('total', 0)}")
        print(f"   Slang Frequency: {slang_usage.get('slangFrequencyPercent', 0):.1f}%")
        
        if breakdown:
            print(f"\n   Score Breakdown:")
            print(f"      Base Score: {breakdown.get('baseScore', 100)}")
            print(f"      Frequency Penalty: {breakdown.get('slangFrequencyPenalty', 0):.2f}")
            print(f"      Severity Penalty: {breakdown.get('slangSeverityPenalty', 0):.2f}")
            print(f"      Repetition Penalty: {breakdown.get('repetitionPenalty', 0):.2f}")
            print(f"      Confidence Penalty: {breakdown.get('confidencePenalty', 0):.2f}")
            print(f"      Engagement Bonus: +{breakdown.get('engagementBonus', 0):.2f}")
            print(f"      = Final Score: {professionalism.get('score', 0):.2f}")
        
        print("\n✅ Professional score calculation test completed")
        return True
        
    except Exception as e:
        print(f"❌ Professional score calculation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_slang_transcript():
    """Test with a transcript containing slang"""
    print("\n" + "="*60)
    print("TEST 4: Testing Slang-Heavy Transcript")
    print("="*60)
    
    slang_transcript = """
    Yo, this meeting is lit, no cap.
    Our product is fire and it's gonna slap.
    The vibes are immaculate, fr fr.
    We need to rizz up the competition.
    This idea hits different, it's a whole mood.
    """
    
    try:
        import asyncio
        result = asyncio.run(HybridDetectionService.analyze_transcript(
            transcript=slang_transcript,
            participant_info={"id": "test_002", "name": "Slang User"}
        ))
        
        # Extract from nested structure
        professionalism = result.get('professionalism', {})
        slang_usage = result.get('slangUsage', {})
        engagement = result.get('engagement', {})
        flagged = result.get('flaggedInstances', [])
        
        print(f"\n📊 SLANG ANALYSIS RESULTS:")
        print(f"   Score: {professionalism.get('score', 0):.2f}/100")
        print(f"   Label: {professionalism.get('label', 'Unknown')}")
        print(f"   Slang Detected: {slang_usage.get('total', 0)}/{engagement.get('totalUtterances', 0)}")
        print(f"   Slang Frequency: {slang_usage.get('slangFrequencyPercent', 0):.1f}%")
        
        print(f"\n   Detected Slang Terms:")
        for instance in flagged:
            term = instance.get('slangTerm', 'unknown')
            confidence = instance.get('confidence', 0)
            print(f"      - {term} (confidence: {confidence:.2f})")
        
        print("\n✅ Slang-heavy transcript test completed")
        return True
        
    except Exception as e:
        print(f"❌ Slang transcript test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("HYBRID DETECTION INTEGRATION TEST SUITE")
    print("="*60)
    
    tests = [
        ("Initialization", test_initialization),
        ("Sentence Analysis", test_sentence_analysis),
        ("Professional Score", test_professional_score),
        ("Slang Detection", test_slang_transcript)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"\n❌ Test '{test_name}' crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Integration is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")


if __name__ == "__main__":
    main()
