# Important TODO:
- Darkness, each client has their own darkness and the server keeps track of "global" darkness used to activate zombies.

# TODO:
- Make one sender class for the server and one for the client
  instead of passing around (ws, packet, outMsgData) or (broadcast, ...).
- Make a room class that handles safely editing the tilemap and stores players, zombies, tilemap.