import { useState } from "react";

const ENHANCED_ID_STATES = ["Michigan", "Minnesota", "New York", "Vermont", "Washington", "Idaho"];

const ALL_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"
];

const BILL_URL = "https://www.congress.gov/bill/119th-congress/house-bill/7296/text";

const QUESTIONS = [
  { key: "registered", text: "Are you currently registered to vote?", subtext: "Even registered voters would be subject to DHS database checks under the SAVE Act." },
  { key: "naturalized", text: "Are you a naturalized citizen?", subtext: "Born outside the U.S. and became a citizen through the naturalization process." },
  { key: "nameChanged", text: "Have you ever changed your legal name?", subtext: "Through marriage, divorce, or court order." },
  { key: "hasPassport", text: "Do you have a valid U.S. passport?", subtext: "A current, unexpired U.S. passport is accepted as standalone proof of citizenship." },
  { key: "hasRealId", text: "Do you have a REAL ID-compliant driver's license or state ID?", subtext: "The gold or black star on your license indicates REAL ID compliance." },
  { key: "hasBirthCertificate", text: "Do you have a certified copy of your U.S. birth certificate?", subtext: "A certified copy is issued by a state vital records office — not a hospital souvenir certificate." },
  { key: "votesByMail", text: "Do you typically vote by mail?", subtext: "Mail-in voting would require additional steps under the SAVE Act." },
];

function ShareBar({ severity }) {
  const [copied, setCopied] = useState(false);

  const messages = {
    clear: `I just checked my voter status under the SAVE Act — I appear ready, but millions of Americans may not be. Find out if YOU are: saveactcheck.com`,
    warning: `I just found out I may need extra documents to stay registered to vote under the SAVE Act. Find out what YOU need: saveactcheck.com`,
    flagged: `The SAVE Act could prevent me from voting without significant paperwork. Find out how it affects you: saveactcheck.com`,
  };

  const shareText = messages[severity] || messages.warning;
  const url = "https://saveactcheck.com";
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&hashtags=SAVEAct,VoterRights`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${shareText}\n\n${url}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      background: "rgba(245,158,11,0.06)",
      border: "1px solid rgba(245,158,11,0.2)",
      borderRadius: "10px",
      padding: "24px",
      marginTop: "24px",
    }}>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#f59e0b", fontFamily: "'Arial', sans-serif", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px" }}>
        Help others find out
      </div>
      <div style={{ fontSize: "14px", color: "#9a9484", fontFamily: "'Arial', sans-serif", marginBottom: "16px", lineHeight: "1.5" }}>
        Most people don't know what the SAVE Act would require. Share this tool — especially with family members who might be affected.
      </div>
      <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px 16px", fontSize: "13px", color: "#e8e4d9", fontFamily: "'Arial', sans-serif", marginBottom: "16px", lineHeight: "1.5", fontStyle: "italic" }}>
        "{shareText}"
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <a href={xUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "10px 16px", fontSize: "13px", fontWeight: "700", fontFamily: "'Arial', sans-serif", textDecoration: "none" }}>
          𝕏 Post on X
        </a>
        <a href={facebookUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#1877f2", color: "#fff", border: "none", borderRadius: "6px", padding: "10px 16px", fontSize: "13px", fontWeight: "700", fontFamily: "'Arial', sans-serif", textDecoration: "none" }}>
          Share on Facebook
        </a>
        <button onClick={copyToClipboard} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)", color: copied ? "#10b981" : "#e8e4d9", border: `1px solid ${copied ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.12)"}`, borderRadius: "6px", padding: "10px 16px", fontSize: "13px", fontWeight: "700", fontFamily: "'Arial', sans-serif", cursor: "pointer", transition: "all 0.2s" }}>
          {copied ? "✓ Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}

export default function SAVEActChecker() {
  const [step, setStep] = useState(0);
  const [selectedState, setSelectedState] = useState("");
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);

  const hasEnhancedId = ENHANCED_ID_STATES.includes(selectedState);

  const handleAnswer = (key, value) => {
    const newAnswers = { ...answers, [key]: value };
    setAnswers(newAnswers);

    const nextQ = currentQ + 1;
    if (nextQ >= QUESTIONS.length) {
      setStep(3);
    } else {
      setCurrentQ(nextQ);
    }
  };

  const getResults = () => {
    const items = [];
    let severity = "clear";

    // Passport check
    if (answers.hasPassport === "yes") {
      items.push({ type: "good", icon: "✓", title: "Passport accepted", detail: "A valid U.S. passport serves as standalone proof of citizenship. You would bring it when registering to vote." });
    }

    // REAL ID check
    if (answers.hasRealId === "yes") {
      if (hasEnhancedId) {
        items.push({ type: "good", icon: "✓", title: `${selectedState} Enhanced ID accepted`, detail: `${selectedState} is one of only 6 states that issues a REAL ID indicating citizenship. Your Enhanced ID may be sufficient on its own.` });
      } else {
        if (answers.hasPassport !== "yes") {
          severity = "warning";
          items.push({ type: "warning", icon: "⚠", title: "Your REAL ID alone would not be enough", detail: `${selectedState} is among the majority of states where a standard REAL ID does not indicate citizenship. You would also need a birth certificate or naturalization certificate to register.` });
        }
      }
    }

    // Birth certificate check (relevant when no passport)
    if (answers.hasPassport !== "yes") {
      if (answers.hasBirthCertificate === "yes" && answers.naturalized !== "yes") {
        items.push({ type: "good", icon: "✓", title: "Birth certificate available", detail: "A certified U.S. birth certificate can serve as proof of citizenship alongside a photo ID. Keep it accessible for registration." });
      } else if (answers.hasBirthCertificate === "no" && answers.naturalized !== "yes") {
        if (severity === "clear") severity = "warning";
        items.push({ type: "warning", icon: "⚠", title: "No birth certificate on hand", detail: "Without a passport or birth certificate, you would need to request a certified copy from the vital records office in the state where you were born. Processing times vary by state." });
      }
    }

    // No documents at all
    if (answers.hasPassport === "no" && answers.hasRealId === "no" && answers.hasBirthCertificate === "no" && answers.naturalized !== "yes") {
      severity = "flagged";
      items.push({ type: "danger", icon: "✗", title: "No qualifying documents found", detail: "Without a passport, photo ID, or birth certificate, you would need to obtain both a government-issued photo ID and a certified birth certificate before you could register." });
    }

    // Naturalized citizen
    if (answers.naturalized === "yes") {
      if (severity === "clear") severity = "warning";
      items.push({ type: "warning", icon: "⚠", title: "Naturalization certificate would be required", detail: "As a naturalized citizen, you would need your Naturalization Certificate (Form N-550 or N-570). The name on this document must match your current legal name." });
    }

    // Name change
    if (answers.nameChanged === "yes") {
      if (answers.hasPassport === "yes") {
        items.push({ type: "good", icon: "✓", title: "Passport may cover your name change", detail: "If your passport reflects your current legal name, it should serve as sufficient proof. If it shows a previous name, you would need documentation connecting it to your current name." });
      } else {
        if (severity === "clear") severity = "warning";
        items.push({ type: "warning", icon: "⚠", title: "Name-change documentation would be required", detail: "You would need every document connecting your current legal name to the name on your citizenship records — such as marriage certificates, divorce decrees, or court orders — forming an unbroken chain." });
      }
    }

    // Already registered
    if (answers.registered === "yes") {
      if (severity === "clear") severity = "warning";
      items.push({ type: "warning", icon: "⚠", title: "Your registration would be re-verified", detail: "Under the SAVE Act, states would be required to run every name on their voter rolls through the DHS SAVE system within 30 days of enactment. If flagged, you would receive notice and need to prove citizenship or face removal — even if you have voted for years." });
    } else if (answers.registered === "no") {
      items.push({ type: "info", icon: "→", title: "You would need to register in person", detail: "Under the SAVE Act, voter registration would require in-person presentation of citizenship documents at an election office, even if you submit a mail registration form." });
    }

    // Mail voting
    if (answers.votesByMail === "yes") {
      if (severity === "clear") severity = "warning";
      items.push({ type: "warning", icon: "⚠", title: "Mail voting would require photo ID", detail: "Under the SAVE Act, you would need to include a copy of a valid photo ID when both requesting and submitting an absentee ballot." });
    }

    const statusMap = {
      clear: { label: "You appear ready", color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "#10b981" },
      warning: { label: "Action may be required", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "#f59e0b" },
      flagged: { label: "At high risk of being unable to vote", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "#ef4444" },
    };

    return { items, severity, status: statusMap[severity] };
  };

  const results = step === 3 ? getResults() : null;
  const progress = step === 1 ? 25 : step === 2 ? 25 + (currentQ / QUESTIONS.length) * 50 : step === 3 ? 100 : 0;

  const styles = {
    app: {
      minHeight: "100vh",
      background: "#080d1a",
      color: "#e8e4d9",
      fontFamily: "'Georgia', serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "0 16px 60px",
    },
    header: {
      width: "100%",
      maxWidth: "680px",
      padding: "40px 0 32px",
      borderBottom: "1px solid rgba(245,158,11,0.3)",
      marginBottom: "48px",
    },
    eyebrow: {
      fontSize: "11px",
      letterSpacing: "3px",
      textTransform: "uppercase",
      color: "#f59e0b",
      marginBottom: "12px",
      fontFamily: "'Arial', sans-serif",
      fontWeight: "600",
    },
    title: {
      fontSize: "clamp(28px, 5vw, 42px)",
      fontWeight: "700",
      lineHeight: "1.15",
      color: "#fff",
      margin: "0 0 12px",
    },
    subtitle: {
      fontSize: "15px",
      color: "#9a9484",
      lineHeight: "1.6",
      fontFamily: "'Arial', sans-serif",
    },
    progressBar: {
      width: "100%",
      maxWidth: "680px",
      height: "2px",
      background: "rgba(255,255,255,0.08)",
      borderRadius: "2px",
      marginBottom: "48px",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      background: "#f59e0b",
      borderRadius: "2px",
      width: `${progress}%`,
      transition: "width 0.4s ease",
    },
    card: {
      width: "100%",
      maxWidth: "680px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      padding: "40px",
    },
    cardTitle: {
      fontSize: "22px",
      fontWeight: "700",
      color: "#fff",
      marginBottom: "8px",
    },
    cardSub: {
      fontSize: "14px",
      color: "#9a9484",
      marginBottom: "32px",
      lineHeight: "1.5",
      fontFamily: "'Arial', sans-serif",
    },
    select: {
      width: "100%",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "8px",
      color: "#e8e4d9",
      fontSize: "16px",
      padding: "14px 16px",
      marginBottom: "24px",
      appearance: "none",
      cursor: "pointer",
      fontFamily: "'Arial', sans-serif",
    },
    btn: {
      background: "#f59e0b",
      color: "#080d1a",
      border: "none",
      borderRadius: "8px",
      padding: "14px 32px",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
      fontFamily: "'Arial', sans-serif",
      letterSpacing: "0.5px",
      transition: "background 0.2s",
    },
    btnOutline: {
      background: "transparent",
      color: "#f59e0b",
      border: "1px solid #f59e0b",
      borderRadius: "8px",
      padding: "14px 32px",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
      fontFamily: "'Arial', sans-serif",
      letterSpacing: "0.5px",
      transition: "all 0.2s",
      marginRight: "12px",
    },
    qText: {
      fontSize: "20px",
      fontWeight: "700",
      color: "#fff",
      marginBottom: "8px",
      lineHeight: "1.3",
    },
    qSub: {
      fontSize: "13px",
      color: "#9a9484",
      marginBottom: "32px",
      fontFamily: "'Arial', sans-serif",
      lineHeight: "1.5",
    },
    answerRow: {
      display: "flex",
      gap: "12px",
    },
    answerBtn: (active) => ({
      flex: 1,
      padding: "16px",
      background: active ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
      border: active ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      color: active ? "#f59e0b" : "#e8e4d9",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
      fontFamily: "'Arial', sans-serif",
      transition: "all 0.15s",
    }),
    qCounter: {
      fontSize: "12px",
      color: "#9a9484",
      fontFamily: "'Arial', sans-serif",
      letterSpacing: "1px",
      marginBottom: "24px",
      textTransform: "uppercase",
    },
    statusBox: (color, bg, border) => ({
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: "10px",
      padding: "20px 24px",
      marginBottom: "32px",
      display: "flex",
      alignItems: "center",
      gap: "16px",
    }),
    statusLabel: (color) => ({
      fontSize: "18px",
      fontWeight: "700",
      color: color,
    }),
    statusSub: {
      fontSize: "13px",
      color: "#9a9484",
      fontFamily: "'Arial', sans-serif",
      marginTop: "2px",
    },
    resultItem: (type) => {
      const colors = {
        good: { border: "rgba(16,185,129,0.3)", icon: "#10b981" },
        warning: { border: "rgba(245,158,11,0.3)", icon: "#f59e0b" },
        danger: { border: "rgba(239,68,68,0.3)", icon: "#ef4444" },
        info: { border: "rgba(255,255,255,0.1)", icon: "#6b7280" },
      };
      return {
        borderLeft: `3px solid ${colors[type].border}`,
        paddingLeft: "20px",
        marginBottom: "24px",
        iconColor: colors[type].icon,
      };
    },
    resultTitle: {
      fontSize: "15px",
      fontWeight: "700",
      color: "#fff",
      marginBottom: "4px",
      fontFamily: "'Arial', sans-serif",
    },
    resultDetail: {
      fontSize: "13px",
      color: "#9a9484",
      lineHeight: "1.6",
      fontFamily: "'Arial', sans-serif",
    },
    disclaimer: {
      width: "100%",
      maxWidth: "680px",
      marginTop: "32px",
      padding: "16px 20px",
      background: "rgba(239,68,68,0.06)",
      border: "1px solid rgba(239,68,68,0.2)",
      borderRadius: "8px",
      fontSize: "12px",
      color: "#9a9484",
      fontFamily: "'Arial', sans-serif",
      lineHeight: "1.6",
    },
  };

  const resetAll = () => {
    setStep(0);
    setSelectedState("");
    setAnswers({});
    setCurrentQ(0);
  };

  // INTRO
  if (step === 0) return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.eyebrow}>Public Interest Tool</div>
        <h1 style={styles.title}>SAVE Act<br />Voter Check</h1>
        <p style={styles.subtitle}>
          The SAVE America Act passed the House on February 11, 2026. This tool helps you understand what you would need to register or remain registered to vote if the bill becomes law.
        </p>
      </div>
      <div style={{ width: "100%", maxWidth: "680px" }}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>What this tool does</div>
          <div style={styles.cardSub}>
            Answer a few questions about your situation. We'll tell you whether you'd be at risk of losing your registration, what documents you'd need, and what steps to take — based on the <a href={BILL_URL} target="_blank" rel="noreferrer" style={{ color: "#f59e0b" }}>actual text of the bill</a>.
          </div>
          <div style={{ display: "flex", gap: "32px", marginBottom: "32px" }}>
            {[["~3 min", "to complete"], ["50 states + DC", "covered"], ["Free", "no signup"]].map(([big, small]) => (
              <div key={big}>
                <div style={{ fontSize: "22px", fontWeight: "700", color: "#f59e0b" }}>{big}</div>
                <div style={{ fontSize: "12px", color: "#9a9484", fontFamily: "'Arial', sans-serif", textTransform: "uppercase", letterSpacing: "1px" }}>{small}</div>
              </div>
            ))}
          </div>
          <button style={styles.btn} onClick={() => setStep(1)}>Get Started →</button>
        </div>
      </div>
      <div style={styles.disclaimer}>
        <strong style={{ color: "#e8e4d9" }}>Important:</strong> This tool presents information as if the SAVE Act has been signed into law. It is for educational purposes only and does not constitute legal advice. Requirements may change. Source: <a href={BILL_URL} target="_blank" rel="noreferrer" style={{ color: "#f59e0b" }}>H.R. 7296</a>, passed House 218–213, February 11, 2026. The bill must still pass the Senate and be signed by the President to become law.
      </div>
    </div>
  );

  // STATE SELECTION
  if (step === 1) return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.eyebrow}>Step 1 of 3</div>
        <h1 style={styles.title}>SAVE Act<br />Voter Check</h1>
      </div>
      <div style={styles.progressBar}><div style={styles.progressFill} /></div>
      <div style={{ width: "100%", maxWidth: "680px" }}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Where do you live?</div>
          <div style={styles.cardSub}>Your state determines whether your REAL ID or driver's license alone can prove citizenship. Only 6 states issue IDs that qualify.</div>
          <select
            style={styles.select}
            value={selectedState}
            onChange={e => setSelectedState(e.target.value)}
          >
            <option value="" style={{ background: "#0e1525", color: "#e8e4d9" }}>Select your state...</option>
            {ALL_STATES.map(s => <option key={s} value={s} style={{ background: "#0e1525", color: "#e8e4d9" }}>{s}</option>)}
          </select>
          {selectedState && (
            <div style={{
              padding: "14px 18px",
              background: hasEnhancedId ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
              border: `1px solid ${hasEnhancedId ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
              borderRadius: "8px",
              marginBottom: "24px",
              fontSize: "13px",
              fontFamily: "'Arial', sans-serif",
              color: hasEnhancedId ? "#10b981" : "#f59e0b",
              lineHeight: "1.5",
            }}>
              {hasEnhancedId
                ? `✓ ${selectedState} is one of 6 states that issues an Enhanced ID indicating citizenship.`
                : `⚠ ${selectedState} is among the majority of states where a standard REAL ID does not indicate citizenship.`}
            </div>
          )}
          <button
            style={{ ...styles.btn, opacity: selectedState ? 1 : 0.4, cursor: selectedState ? "pointer" : "default" }}
            disabled={!selectedState}
            onClick={() => setStep(2)}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );

  // QUESTIONS
  if (step === 2) {
    const q = QUESTIONS[currentQ];

    return (
      <div style={styles.app}>
        <div style={styles.header}>
          <div style={styles.eyebrow}>Step 2 of 3 — Your Situation</div>
          <h1 style={styles.title}>SAVE Act<br />Voter Check</h1>
        </div>
        <div style={styles.progressBar}><div style={styles.progressFill} /></div>
        <div style={{ width: "100%", maxWidth: "680px" }}>
          <div style={styles.card}>
            <div style={styles.qCounter}>Question {currentQ + 1} of {QUESTIONS.length}</div>
            <div style={styles.qText}>{q.text}</div>
            <div style={styles.qSub}>{q.subtext}</div>
            <div style={styles.answerRow}>
              {["yes", "no"].map(val => (
                <button
                  key={val}
                  style={styles.answerBtn(answers[q.key] === val)}
                  onClick={() => handleAnswer(q.key, val)}
                >
                  {val === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <button style={styles.btnOutline} onClick={() => {
              if (currentQ === 0) setStep(1);
              else setCurrentQ(currentQ - 1);
            }}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  // RESULTS
  if (step === 3 && results) {
    return (
      <div style={styles.app}>
        <div style={styles.header}>
          <div style={styles.eyebrow}>Your Results — {selectedState}</div>
          <h1 style={styles.title}>SAVE Act<br />Voter Check</h1>
        </div>
        <div style={styles.progressBar}><div style={styles.progressFill} /></div>
        <div style={{ width: "100%", maxWidth: "680px" }}>
          <div style={styles.statusBox(results.status.color, results.status.bg, results.status.border)}>
            <div style={{ fontSize: "28px" }}>
              {results.severity === "clear" ? "✓" : results.severity === "warning" ? "⚠" : "✗"}
            </div>
            <div>
              <div style={styles.statusLabel(results.status.color)}>{results.status.label}</div>
              <div style={styles.statusSub}>
                {results.severity === "clear" && "Review the details below to confirm."}
                {results.severity === "warning" && "You would need to take steps before or after the law takes effect."}
                {results.severity === "flagged" && "Without action, you may be unable to register or vote."}
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ ...styles.cardTitle, marginBottom: "24px" }}>What this would mean for you</div>
            {results.items.map((item, i) => {
              const ri = styles.resultItem(item.type);
              return (
                <div key={i} style={{ borderLeft: ri.borderLeft, paddingLeft: ri.paddingLeft, marginBottom: ri.marginBottom }}>
                  <div style={{ ...styles.resultTitle, color: ri.iconColor }}>{item.icon} {item.title}</div>
                  <div style={styles.resultDetail}>{item.detail}</div>
                </div>
              );
            })}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "24px", marginTop: "8px" }}>
              <div style={{ ...styles.cardTitle, fontSize: "16px", marginBottom: "16px" }}>What to do now</div>
              <div style={{ fontSize: "13px", fontFamily: "'Arial', sans-serif", color: "#9a9484", lineHeight: "1.8" }}>
                {answers.hasPassport !== "yes" && <div>→ <strong style={{ color: "#e8e4d9" }}>Get a passport</strong> — Apply at <a href="https://travel.state.gov" target="_blank" rel="noreferrer" style={{ color: "#f59e0b" }}>travel.state.gov</a>. Standard processing takes 6–8 weeks.</div>}
                {answers.nameChanged === "yes" && answers.hasPassport !== "yes" && <div>→ <strong style={{ color: "#e8e4d9" }}>Gather name-change documents</strong> — Every marriage certificate, divorce decree, or court order connecting your names.</div>}
                {answers.naturalized === "yes" && <div>→ <strong style={{ color: "#e8e4d9" }}>Locate your Naturalization Certificate</strong> — If lost, request a replacement at <a href="https://www.uscis.gov" target="_blank" rel="noreferrer" style={{ color: "#f59e0b" }}>uscis.gov</a>.</div>}
                {answers.hasBirthCertificate === "no" && answers.naturalized !== "yes" && answers.hasPassport !== "yes" && <div>→ <strong style={{ color: "#e8e4d9" }}>Get a certified birth certificate</strong> — Contact the vital records office in the state where you were born.</div>}
                <div>→ <strong style={{ color: "#e8e4d9" }}>Monitor your registration status</strong> — Check regularly with your state's election office, especially if this bill becomes law.</div>
                <div>→ <strong style={{ color: "#e8e4d9" }}>Read the bill</strong> — <a href={BILL_URL} target="_blank" rel="noreferrer" style={{ color: "#f59e0b" }}>Full text of H.R. 7296 on Congress.gov</a></div>
              </div>
            </div>
          </div>

          <ShareBar severity={results.severity} />

          <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button style={styles.btnOutline} onClick={resetAll}>Start Over</button>
            <button style={styles.btn} onClick={() => window.print()}>Print Results</button>
          </div>
        </div>
        <div style={styles.disclaimer}>
          <strong style={{ color: "#e8e4d9" }}>Disclaimer:</strong> This tool presents results as if the SAVE Act were law. It is for educational purposes only, not legal advice. Results are based on the bill text of <a href={BILL_URL} target="_blank" rel="noreferrer" style={{ color: "#f59e0b" }}>H.R. 7296</a> as passed by the House on February 11, 2026. The bill must still pass the Senate and be signed by the President to become law. Requirements may change during the legislative process.
        </div>
      </div>
    );
  }

  return null;
}
