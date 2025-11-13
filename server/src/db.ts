import Database from 'better-sqlite3'

export const db = new Database('aviator.db')

export function init() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      provider TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS site_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      site_id TEXT NOT NULL,
      status TEXT NOT NULL, -- granted | revoked
      provider TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, site_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL, -- pending | success | failed
      request_id TEXT,
      external_id TEXT,
      phone TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      dark INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `)
}

export function seedSites() {
  const sites: [string,string,number,number][] = [
    ['1win','1win',1,0],
    ['sports-aviator','SPORTS Aviator',1,1],
    ['1xbet','1XBET',1,0],
    ['22bet','22BET',1,0],
    ['4rabet','4RABET',1,1],
    ['888starz','888Starz',1,1],
    ['bangbet','BANG BET',1,0],
    ['bantubet','BANTU bet',1,1],
    ['bolabet','BOLABET',1,1],
    ['bet365','bet365',1,0],
    ['betfalme','betfalme',1,1],
    ['betgr8','betgr8',1,1],
    ['betika','Betika!',1,0],
    ['sportpesa','SportPesa',1,0],
    ['sportybet','SportyBet',1,0],
    ['betlion','BetLion',1,0],
    ['betpawa','betPawa',1,1],
    ['betway','betway',1,0],
    ['bluechip','blue chip',1,1],
    ['casinodays','CasinoDays',1,0],
    ['chezacash','ChezaCash',1,0],
    ['fortebet','FORTEBET',1,1],
    ['hakibets','hakibets',1,1],
    ['hollywoodbets','Hollywood bets',1,0],
    ['ilotbet','iLOTBET',1,1],
    ['kwikbet','KwikBet',1,1],
    ['melbet','MELBET',1,0],
    ['betting-co-zw','betting co.zw',1,0],
    ['mostbet','MOSTBET',1,0],
    ['odibets','ODIBETS',1,0],
    ['parimatch','PARIMATCH',1,1],
    ['wezabet','WezaBet',1,0],
    ['winwin','WINWIN',1,0],
    ['betwinner','BetWinner',1,0],
    ['betafriq','BetAfriq',1,1],
    // Added per request
    ['bet9ja','Bet9ja',1,0],
    ['mozzartbet','MozzartBet',1,0],
    ['premierbet','Premier Bet',1,0],
    ['supabets','Supabets',1,0],
    ['10bet','10Bet',1,0],
    ['betsson','Betsson',1,0],
    ['betclic','Betclic',1,0],
    ['stake','Stake.com',1,0],
    ['bc-game','BC.Game',1,0],
    ['roobet','Roobet',1,0],
    ['1xbit','1xBit',1,0],
  ]
  const existsStmt = db.prepare('SELECT 1 FROM sites WHERE id = ?')
  const insertStmt = db.prepare('INSERT INTO sites (id,name,active,dark) VALUES (?,?,?,?)')
  const tx = db.transaction((rows: any[]) => {
    rows.forEach((r: any) => {
      const [id] = r
      const exists = existsStmt.get(id) as any
      if (!exists) insertStmt.run(...r)
    })
  })
  tx(sites)
}

export function removeWhiteVariantSites() {
  const ids = ['betnaija-white','premierbet-white','10bets-white','stake.com-white','roobet-white']
  const del = db.prepare('DELETE FROM sites WHERE id = ?')
  const tx = db.transaction((list: string[]) => {
    list.forEach((id) => del.run(id))
  })
  tx(ids)
}