export const et = {
  nav: {
    predict: 'Ennustused',
    bonus: 'Boonused',
    results: 'Tulemused',
    leaderboard: 'Edetabel',
    details: 'Punktid',
    rules: 'Reeglid',
    admin: 'Haldus'
  },
  stages: {
    GROUP: 'Alagrupid',
    R32: '1/16-finaalid',
    R16: 'Kaheksandikfinaalid',
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
    cannotDeleteSelf: 'Haldur ei saa iseennast kustutada',
    deleteConfirmationMismatch: 'Kustutamise kinnitus ei klapi osaleja nimega',
    invalidCredentials: 'Sisselogimise andmed ei ole õiged',
    authRequired: 'Palun logi sisse',
    accessDenied: 'Ligipääs puudub',
    duplicateFullName: 'Selle täisnimega osaleja on juba olemas. Võta ühendust korraldajaga.',
    incompleteFinal: 'Lõplik ennustus on puudulik',
    penaltyRequired: 'Viigilise playoff-ennustuse korral vali penaltiseeria võitja',
    invalidInvite: 'Liiga kutsekood ei ole õige'
  }
};

export function errorEt(message: string): string {
  return ({
    'Predictions are locked': et.errors.locked,
    'Prediction deadline has passed': et.errors.deadlinePassed,
    'Admin access required': et.errors.adminRequired,
    'Invalid deadline': et.errors.invalidDeadline,
    'Player not found': et.errors.playerNotFound,
    'Admin cannot delete own player': et.errors.cannotDeleteSelf,
    'Player delete confirmation does not match': et.errors.deleteConfirmationMismatch,
    'Invalid credentials': et.errors.invalidCredentials,
    'Invalid admin credentials': et.errors.invalidCredentials,
    'Authentication required': et.errors.authRequired,
    'Access denied': et.errors.accessDenied,
    'Player with this full name already exists': et.errors.duplicateFullName,
    'Final prediction is incomplete': et.errors.incompleteFinal,
    'Penalty winner is required': et.errors.penaltyRequired,
    'Invalid invite code': et.errors.invalidInvite
  } as Record<string, string>)[message] ?? message;
}

export function teamNameEt(team: any): string {
  return team?.name_et || team?.nameEt || team?.name || 'Vali riik';
}
