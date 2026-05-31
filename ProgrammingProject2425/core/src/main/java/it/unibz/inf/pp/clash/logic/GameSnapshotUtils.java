package it.unibz.inf.pp.clash.logic;

import com.badlogic.gdx.Gdx;
import it.unibz.inf.pp.clash.model.bot.BotPlayer;
import it.unibz.inf.pp.clash.model.impl.GameEventHandler;
import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot;
import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;
import it.unibz.inf.pp.clash.view.DisplayManager;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Butterfly;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit.UnitColor;

import it.unibz.inf.pp.clash.model.snapshot.units.impl.Fairy;

import java.util.*;


public class GameSnapshotUtils {


    //random butterflies
    public static void placeRandomButterflies(GameSnapshot gs, int count, int[] targetRows) {
        List<Board.TileCoordinates> validTiles = new ArrayList<>();

        for (int row : targetRows) {
            for (int col = 0; col <= gs.getBoard().getMaxColumnIndex(); col++) {
                if (gs.getBoard().getUnit(row, col).isEmpty()) {
                    validTiles.add(new Board.TileCoordinates(row, col));
                }
            }
        }

        Collections.shuffle(validTiles);
        Random random = new Random();

        int placed = 0;
        while (placed < count && !validTiles.isEmpty()) {
            Board.TileCoordinates pos = validTiles.remove(0);
            UnitColor color = UnitColor.values()[random.nextInt(3)];
            gs.getBoard().addUnit(pos.rowIndex(), pos.columnIndex(), new Butterfly(color));
            placed++;
        }
    }


    public static void doBotTurn(GameSnapshot gs, DisplayManager displayManager) {

        var currentPlayer = gs.getActivePlayer();
        var botHandleOpt = switch (currentPlayer) {
            case FIRST -> gs.getFirstBotPlayer();
            case SECOND -> gs.getSecondBotPlayer();
        };
        if (botHandleOpt.isEmpty()) throw new RuntimeException("Cannot perform a bot turn without a BotPlayer object.");
        var botPlayer = botHandleOpt.get();
        // Create a new thread so that the main rendering thread doesn't hang
        new Thread(() -> {
            try {
                // --- First Move ---
                botPlayer.PlayMove(gs);
                Gdx.graphics.requestRendering(); // This is necessary since we're using lazy rendering
                Thread.sleep(BotPlayer.BOT_MOVE_DELAY);
                // Check if the turn is still the bot's turn.
                if (gs.getActivePlayer() != currentPlayer) {
                    System.out.println("Bot turn was skipped");
                    return;
                }


                // --- Second Move ---
                botPlayer.PlayMove(gs);
                Gdx.graphics.requestRendering();
                Thread.sleep(BotPlayer.BOT_MOVE_DELAY);
                if (gs.getActivePlayer() != currentPlayer) {
                    System.out.println("Bot turn was skipped");
                    return;
                }
                // --- Third Move ---
                botPlayer.PlayMove(gs);
                Gdx.graphics.requestRendering();

                System.out.println("Bot has finished its turn.");

                if (gs.getActivePlayer() == currentPlayer) {
                    var handler = GameEventHandler.getInstance();
                    handler.skipTurn(true); // Sometimes LLMs generated moves that are invalid, so we skip the turn
                } else {
                    System.out.println("Bot's turn was skipped.");
                }


            } catch (InterruptedException e) {
                System.err.println("Bot's turn was interrupted.");
                Thread.currentThread().interrupt();
                var handler = GameEventHandler.getInstance();
                handler.skipTurn(true); // Skip the turn if interrupted
            }
        }).start();
    }

    public static void switchTurn(GameSnapshot gs, DisplayManager displayManager) throws GameEndException {
        var previousActivePlayer = gs.getActivePlayer();
        var previousActiveHero = gs.getHero(previousActivePlayer);
        gs.setActivePlayer((previousActivePlayer == Snapshot.Player.FIRST) ? Snapshot.Player.SECOND : Snapshot.Player.FIRST);
        gs.setActionsRemaining(3);
        gs.clearOngoingMove();

        var activePlayer = gs.getActivePlayer();
        var activePlayerBoard = gs.getNormalizedBoard(activePlayer);

        activePlayerBoard.updateFormations(previousActiveHero, gs.getNormalizedBoard(previousActivePlayer));

        var activeHero = gs.getHero(activePlayer);
        if (previousActiveHero.getHealth() <= 0) {
            System.out.println(activeHero.getName() + " WON!");
            throw new GameEndException();
        }
        if (activeHero.isBot()) {
            doBotTurn(gs, displayManager);
        }

    }

    //consuming actions
    public static void consumeAction(GameSnapshot gs, DisplayManager displayManager) {

        gs.decrementActions();
        int remaining = gs.getNumberOfRemainingActions();

        if (remaining <= 0) {
            try {
                switchTurn(gs, displayManager);
            } catch (GameEndException e) {
                GameEventHandler.getInstance().exitGame();
                return;
            }
            displayManager.drawSnapshot(gs, "Turn ended. Now it's " + gs.getActivePlayer() + "'s turn.");
        } else {
            displayManager.drawSnapshot(gs, "Action performed. Remaining: " + remaining);
        }
    }


    //checking who can interact with what (no cheating!!!)
    public static boolean isTileOwnedByActivePlayer(Snapshot snapshot, int rowIndex, DisplayManager displayManager, boolean isBotMove) {
        if (!(snapshot instanceof GameSnapshot gs)) return false;
        var currentHero = snapshot.getHero(snapshot.getActivePlayer());

        // Prevent the player from moving "as a bot"
        if (currentHero.isBot() && !isBotMove) return false;

        boolean isValid = switch (gs.getActivePlayer()) {
            case FIRST -> rowIndex >= (snapshot.getBoard().getMaxRowIndex() / 2) + 1;
            case SECOND -> rowIndex <= (snapshot.getBoard().getMaxRowIndex() / 2);
        };

        if (!isValid) {
            displayManager.drawSnapshot(gs, "You cannot interact with your opponent's board!!");
        }

        return isValid;
    }

    //triggers the abilities at the end of turns
    public static void handleTurnEndAbilities(GameSnapshot gs, Snapshot.Player playerEndingTurn) {

        triggerFairyAbilities(gs, playerEndingTurn);
        //put other abilities here
    }


    //fairy ability
    public static void triggerFairyAbilities(GameSnapshot gs, Snapshot.Player previousPlayer) {
        Board board = gs.getBoard();
        int maxRow = board.getMaxRowIndex();
        int maxCol = board.getMaxColumnIndex();
        Random random = new Random();
        UnitColor[] colors = UnitColor.values();

        for (int row = 0; row <= maxRow; row++) {
            for (int col = 0; col <= maxCol; col++) {
                var unit = board.getUnit(row, col);
                if (unit.isPresent() && unit.get() instanceof Fairy) {

                    // where is the fairy owo
                    boolean isFairyOwnedByPlayer = switch (previousPlayer) {
                        case FIRST -> row >= 6;
                        case SECOND -> row <= 5;
                    };

                    if (!isFairyOwnedByPlayer) continue;

                    List<Board.TileCoordinates> freeAdjacent = new ArrayList<>();

                    for (int dr = -1; dr <= 1; dr++) {
                        for (int dc = -1; dc <= 1; dc++) {
                            int nr = row + dr;
                            int nc = col + dc;

                            if ((dr != 0 || dc != 0) &&
                                    board.areValidCoordinates(nr, nc) &&
                                    board.getUnit(nr, nc).isEmpty()) {

                                boolean isFriendlyZone = switch (previousPlayer) {
                                    case FIRST -> nr >= 6;
                                    case SECOND -> nr <= 5;
                                };

                                if (isFriendlyZone) {
                                    freeAdjacent.add(new Board.TileCoordinates(nr, nc));
                                }
                            }
                        }
                    }

                    if (!freeAdjacent.isEmpty()) {
                        var chosen = freeAdjacent.get(random.nextInt(freeAdjacent.size()));
                        UnitColor randomColor = colors[random.nextInt(colors.length)];
                        board.addUnit(chosen.rowIndex(), chosen.columnIndex(), new Butterfly(randomColor));
                    }

                }

            }
        }
    }


}

