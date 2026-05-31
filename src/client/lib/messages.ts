export const et = {
  nav: {
    predict: 'Ennustused',
    bonus: 'Boonused',
    leaderboard: 'Edetabel',
    details: 'Punktid',
    admin: 'Haldus'
  },
  stages: {
    GROUP: 'Alagrupid',
    R32: '1/32-finaalid',
    R16: '1/16-finaalid',
    QF: 'Veerandfinaalid',
    SF: 'Poolfinaalid',
    THIRD_PLACE: '3. koha mäng',
    FINAL: 'Finaal'
  },
  playerStatus: {
    pending: 'Sinu osalus ootab korraldaja kinnitust. Ennustused saad juba salvestada; arvestusse lähevad need pärast kinnitamist, kui need on esitatud enne tähtaega.',
    disabled: 'Sinu osalus ei ole ametlikus edetabelis aktiivne. Võta ühendust korraldajaga.'
  },
  errors: {
    locked: 'Ennustused on lukus',
    deadlinePassed: 'Ennustuste tähtaeg on möödas',
    adminRequired: 'Halduri ligipääs on vajalik',
    invalidDeadline: 'Tähtaeg ei ole korrektne',
    playerNotFound: 'Kasutajat ei leitud',
    cannotDeleteSelf: 'Haldur ei saa iseennast kustutada'
  }
};

export function errorEt(message: string): string {
  return ({
    'Predictions are locked': et.errors.locked,
    'Prediction deadline has passed': et.errors.deadlinePassed,
    'Admin access required': et.errors.adminRequired,
    'Invalid deadline': et.errors.invalidDeadline,
    'Player not found': et.errors.playerNotFound,
    'Admin cannot delete own player': et.errors.cannotDeleteSelf
  } as Record<string, string>)[message] ?? message;
}

export function teamNameEt(team: any): string {
  return team?.name_et || team?.nameEt || team?.name || 'Vali riik';
}
