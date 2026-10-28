// Old Pumpworks: rust, steam, beetles. The Pump Room (bottom left) is the boss arena.
// The way in is the long way round: across the beetle hall, down the east corridor, and through a
// one-tile duct (the goblin fits, the Matron doesn't). v = steam valves, u = vents.
// 1: Fungus Cistern (crawl pipe)  2: sluice shortcut to the Cistern (reachable from the east corridor)
// The pump drain gate (==) from the Pump Room straight up into the hall opens when the Matron is defeated.
export const PUMPWORKS_MAP = [
  '#################1######################',
  '#################.######################',
  '######.....k......#######.....k...######',
  '#####....b.........#####....m.......####',
  '####.....YY.......h.........YY.....k.###',
  '####..k..YY.............b...YY.......###',
  '#####......J....####......m..h.......###',
  '######......k...####....k....b.......###',
  '##########==####################...#####',
  '##########..####################...#####',
  '####.v..........v...############...#####',
  '###..................###########...#####',
  '##.....................#########...cc2##',
  '##.................................#####',
  '##..........B..........#################',
  '##.....................#################',
  '###..u...........u....##################',
  '####.................###################',
  '########################################',
];
