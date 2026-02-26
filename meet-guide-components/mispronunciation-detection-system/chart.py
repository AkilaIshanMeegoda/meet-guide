import matplotlib.pyplot as plt
import numpy as np

# ============================================================================
# DATA: Multi-Participant ASR Comparison Results
# ============================================================================

# Per-participant data
participants = ['Chalana', 'Savishka', 'Dinithi', 'OVERALL']

whisper_wer = [12.33, 12.99, 2.65, 9.23]
whisper_accuracy = [87.67, 87.01, 97.35, 90.77]

wav2vec_wer = [46.58, 51.95, 28.32, 41.67]
wav2vec_accuracy = [53.42, 48.05, 71.68, 58.33]

# Error breakdown for overall
whisper_errors = {'substitutions': 9, 'insertions': 4, 'deletions': 5, 'total': 31}
wav2vec_errors = {'substitutions': 59, 'insertions': 6, 'deletions': 3, 'total': 140}

# ============================================================================
# CHART 1: WER Comparison by Participant
# ============================================================================

fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle('ASR Model Comparison: Whisper vs wav2vec2', fontsize=16, fontweight='bold')

# Chart 1: WER by Participant (Bar Chart)
ax1 = axes[0, 0]
x = np.arange(len(participants))
width = 0.35

bars1 = ax1.bar(x - width/2, whisper_wer, width, label='Whisper-small', color='#2ecc71', edgecolor='black')
bars2 = ax1.bar(x + width/2, wav2vec_wer, width, label='wav2vec2-base', color='#e74c3c', edgecolor='black')

ax1.set_ylabel('WER (%)', fontsize=11)
ax1.set_title('Word Error Rate (WER) by Participant', fontsize=12, fontweight='bold')
ax1.set_xticks(x)
ax1.set_xticklabels(participants, fontsize=10)
ax1.legend(loc='upper right')
ax1.set_ylim(0, 60)
ax1.grid(axis='y', alpha=0.3)

# Add value labels
for bar in bars1:
    height = bar.get_height()
    ax1.annotate(f'{height:.1f}%', xy=(bar.get_x() + bar.get_width()/2, height),
                 xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=9)
for bar in bars2:
    height = bar.get_height()
    ax1.annotate(f'{height:.1f}%', xy=(bar.get_x() + bar.get_width()/2, height),
                 xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=9)

# ============================================================================
# CHART 2: Accuracy Comparison
# ============================================================================

ax2 = axes[0, 1]
bars3 = ax2.bar(x - width/2, whisper_accuracy, width, label='Whisper-small', color='#2ecc71', edgecolor='black')
bars4 = ax2.bar(x + width/2, wav2vec_accuracy, width, label='wav2vec2-base', color='#e74c3c', edgecolor='black')

ax2.set_ylabel('Accuracy (%)', fontsize=11)
ax2.set_title('Accuracy by Participant', fontsize=12, fontweight='bold')
ax2.set_xticks(x)
ax2.set_xticklabels(participants, fontsize=10)
ax2.legend(loc='lower right')
ax2.set_ylim(0, 110)
ax2.grid(axis='y', alpha=0.3)

for bar in bars3:
    height = bar.get_height()
    ax2.annotate(f'{height:.1f}%', xy=(bar.get_x() + bar.get_width()/2, height),
                 xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=9)
for bar in bars4:
    height = bar.get_height()
    ax2.annotate(f'{height:.1f}%', xy=(bar.get_x() + bar.get_width()/2, height),
                 xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=9)

# ============================================================================
# CHART 3: Overall Model Comparison (Horizontal Bar)
# ============================================================================

ax3 = axes[1, 0]
models = ['Whisper-small', 'wav2vec2-base']
overall_wer = [9.23, 41.67]
overall_acc = [90.77, 58.33]

y_pos = np.arange(len(models))
colors = ['#2ecc71', '#e74c3c']

bars5 = ax3.barh(y_pos, overall_acc, color=colors, edgecolor='black', height=0.5)
ax3.set_yticks(y_pos)
ax3.set_yticklabels(models, fontsize=11)
ax3.set_xlabel('Accuracy (%)', fontsize=11)
ax3.set_title('Overall Accuracy Comparison', fontsize=12, fontweight='bold')
ax3.set_xlim(0, 100)
ax3.grid(axis='x', alpha=0.3)

for i, (bar, acc, wer) in enumerate(zip(bars5, overall_acc, overall_wer)):
    ax3.annotate(f'{acc:.2f}% (WER: {wer:.2f}%)', 
                 xy=(bar.get_width() - 2, bar.get_y() + bar.get_height()/2),
                 ha='right', va='center', fontsize=10, fontweight='bold', color='white')

# Add winner badge
ax3.annotate('* WINNER *', xy=(92, 0), fontsize=10, fontweight='bold', color='#27ae60')

# ============================================================================
# CHART 4: Error Type Breakdown (Pie Charts)
# ============================================================================

ax4 = axes[1, 1]
ax4.axis('off')

# Create two pie charts side by side using inset axes
from mpl_toolkits.axes_grid1.inset_locator import inset_axes

# Whisper pie chart
ax_pie1 = inset_axes(ax4, width="40%", height="80%", loc='center left')
whisper_vals = [whisper_errors['substitutions'], whisper_errors['insertions'], whisper_errors['deletions']]
whisper_labels = [f"Sub: {whisper_errors['substitutions']}", f"Ins: {whisper_errors['insertions']}", f"Del: {whisper_errors['deletions']}"]
colors_pie = ['#3498db', '#f39c12', '#9b59b6']
ax_pie1.pie(whisper_vals, labels=whisper_labels, colors=colors_pie, autopct='%1.0f%%', startangle=90)
ax_pie1.set_title(f"Whisper Errors\n(Total: {whisper_errors['total']})", fontsize=10, fontweight='bold')

# wav2vec2 pie chart
ax_pie2 = inset_axes(ax4, width="40%", height="80%", loc='center right')
wav2vec_vals = [wav2vec_errors['substitutions'], wav2vec_errors['insertions'], wav2vec_errors['deletions']]
wav2vec_labels = [f"Sub: {wav2vec_errors['substitutions']}", f"Ins: {wav2vec_errors['insertions']}", f"Del: {wav2vec_errors['deletions']}"]
ax_pie2.pie(wav2vec_vals, labels=wav2vec_labels, colors=colors_pie, autopct='%1.0f%%', startangle=90)
ax_pie2.set_title(f"wav2vec2 Errors\n(Total: {wav2vec_errors['total']})", fontsize=10, fontweight='bold')

# ============================================================================
# SUMMARY TABLE
# ============================================================================

plt.tight_layout(rect=[0, 0.08, 1, 0.95])

# Add summary text at bottom
summary_text = (
    "SUMMARY: Whisper-small achieves 90.77% accuracy (WER: 9.23%) vs wav2vec2's 58.33% accuracy (WER: 41.67%)\n"
    "Whisper is 4.5x better than wav2vec2 for Sri Lankan accented English speech recognition"
)
fig.text(0.5, 0.02, summary_text, ha='center', fontsize=10, style='italic', 
         bbox=dict(boxstyle='round', facecolor='#ecf0f1', alpha=0.8))

plt.savefig('asr_comparison_chart.png', dpi=150, bbox_inches='tight', facecolor='white')
print("Chart saved to: asr_comparison_chart.png")
plt.show()