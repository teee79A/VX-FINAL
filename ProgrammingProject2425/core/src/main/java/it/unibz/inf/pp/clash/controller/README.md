# Controller

This component reacts to some user inputs (like mouse clicks or hovering).

For each of these inputs, the controller calls one of the methods exposed by the `EventHandler` interface in the `model` component.

More precisely:
- on the home screen, a left click on the "new game" button triggers a call to the method `EventHandler.newgame`
- on the game screen:
  - a left click on the "exit" button triggers a call to `EventHandler.exitGame`,
  - a left click on the "skip turn" button triggers a call to `EventHandler.skipTurn`,
  - a left click on the "reinforcement" button triggers a call to `EventHandler.callReinforcement`,
  - hovering over an empty tile or a unit's icon triggers a call to `EventHandler.requestInformation`,
  - a left click an empty tile or a unit's icon triggers a call to `EventHandler.selectTile`,
  - a right click on a unit icon triggers a call to `EventHandler.deleteUnit`.
