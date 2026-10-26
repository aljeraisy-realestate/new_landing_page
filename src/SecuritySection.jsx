export default function SecuritySection({ copy, Icon }) {
  const c = copy.security;
  return <section className="security section-space" id="security" aria-labelledby="security-title">
    <div className="shell security-layout">
      <div className="security-copy">
        <span className="security-emblem" aria-hidden="true"><Icon name="shield" /></span>
        <p className="eyebrow">{c.label}</p><h2 id="security-title">{c.title}</h2><p className="security-intro">{c.intro}</p>
        <ul className="security-reasons">{c.reasons.map((reason) => <li key={reason}><Icon name="check" />{reason}</li>)}</ul>
        <a className="text-link" href="#how-it-works">{c.cta}<Icon name="arrow" /></a>
        <p className="security-availability">{c.availability}</p>
      </div>
      <div className="security-custody" aria-labelledby="payment-flow-title">
        <div className="security-custody-heading"><span lang="en" dir="ltr">Giftly</span><Icon name="lock" /></div>
        <h3 id="payment-flow-title">{c.flowLabel}</h3>
        <ol className="security-flow">{c.stages.map((stage, index) => <li key={stage.title}><span className="security-stage-icon" aria-hidden="true"><Icon name={stage.icon} /></span><div><span className="security-stage-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h4>{stage.title}</h4><p>{stage.body}</p></div></li>)}</ol>
        <div className="security-release-rule"><Icon name="shield" /><strong>{c.rule}</strong></div>
      </div>
    </div>
  </section>;
}
