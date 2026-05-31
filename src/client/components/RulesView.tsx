const sections = [
  {
    title: 'Osalemine',
    items: [
      'Ennustus tuleb esitada enne määratud tähtaega.',
      'Osalustasu maksmine toimub väljaspool rakendust otse korraldajale.',
      'Osaleja läheb ametlikku arvestusse pärast korraldaja kinnitust.',
      'Kui ennustus on esitatud enne tähtaega, jääb see kehtivaks ka siis, kui korraldaja kinnitab osaleja hiljem.'
    ]
  },
  {
    title: 'Alagrupimängude punktid',
    items: [
      'Täpne tulemus – 6 punkti',
      'Õige võitja või viik ja õige väravate vahe – 4 punkti',
      'Õige võitja või viik – 2 punkti',
      'Vale tulemus – 0 punkti'
    ]
  },
  {
    title: 'Alagrupi boonused',
    items: [
      'Õige alagrupi võitja – 10 punkti',
      'Õige teine koht – 5 punkti',
      'Õige edasipääseja – 3 punkti'
    ]
  },
  {
    title: 'Playoff ja turniiriboonused',
    items: [
      'Playoff-mängude skooripunktid arvestatakse bracket-slot põhimõttel: võrreldakse sinu ennustatud kodu- ja võõrsil slotti tegeliku sama sloti tulemusega.',
      'Õige riik 1/16-finaalis – 15 punkti',
      'Õige riik veerandfinaalis – 20 punkti',
      'Õige riik poolfinaalis – 25 punkti',
      'Õige riik finaalis – 30 punkti',
      'Õige 3. koha mängu võitja – 40 punkti',
      'Õige maailmameister – 100 punkti',
      'Suurim väravakütt – 50 punkti; mitme võitja korral jagatakse punktid reeglite järgi.'
    ]
  },
  {
    title: 'Edetabel',
    items: [
      'Ametlikus edetabelis kuvatakse ainult korraldaja kinnitatud osalejad.',
      'Võrdsete punktide korral on eespool mängija, kes esitas ennustuse varem.'
    ]
  }
];

export function RulesView({ onBack }: { onBack?: () => void }) {
  return (
    <section className="rules-page">
      <div className="summary">
        <strong>Reeglid</strong>
        {onBack && <button className="ghost" onClick={onBack}>Tagasi</button>}
      </div>
      <div className="rules-grid">
        {sections.map((section) => (
          <article className="panel rule-card" key={section.title}>
            <h2>{section.title}</h2>
            <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export const rulesSections = sections;
