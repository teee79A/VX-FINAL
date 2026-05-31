package it.unibz.inf.pp.clash.model.impl;

import it.unibz.inf.pp.clash.logic.GameEndException;
import it.unibz.inf.pp.clash.logic.GameSnapshotUtils;
import it.unibz.inf.pp.clash.model.BoardInitializer;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.model.MoveHandler;
import it.unibz.inf.pp.clash.model.movehandlers.DefaultMoveHandlerImpl;
import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.snapshot.NormalizedBoard;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot;

import static it.unibz.inf.pp.clash.model.snapshot.Snapshot.Player;

import it.unibz.inf.pp.clash.model.snapshot.impl.NormalizedBoardImpl;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.*;
import it.unibz.inf.pp.clash.view.DisplayManager;
import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;
import it.unibz.inf.pp.clash.model.snapshot.impl.HeroImpl;
import it.unibz.inf.pp.clash.model.snapshot.impl.BoardImpl;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit.UnitColor;

import static it.unibz.inf.pp.clash.logic.GameSnapshotUtils.*;

import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;

import java.util.Random;
import java.util.function.Function;


public class GameEventHandler implements EventHandler {

    DisplayManager displayManager;
    Snapshot snapshot;
    MoveHandler moveHandler;

    static private GameEventHandler instance;

    public GameEventHandler(DisplayManager displayManager) {
        if (instance != null) throw new RuntimeException("GameEventHandler should be a singleton");
        instance = this;
        this.displayManager = displayManager;
        moveHandler = new DefaultMoveHandlerImpl();
    }


    public static GameEventHandler getInstance() {
        return instance;
    }


    @Override
    public void newGame(String firstHero, String secondHero) {
        newGame(firstHero, secondHero, this::initializeBoardRandom, 7, 11);
        NormalizedBoardImpl.initRemovedUnitsCount();
        var firstTurnHero = snapshot.getHero(snapshot.getActivePlayer());
        if (firstTurnHero.isBot()) {
            GameSnapshotUtils.doBotTurn((GameSnapshot) snapshot, displayManager);
        }
    }

    public void newGame(String firstHero, String secondHero, BoardInitializer boardInitializer, int boardWidth, int boardHeight) {
        System.out.println("Starting a new game: " + firstHero + " vs " + secondHero);
        snapshot = new GameSnapshot(
                new HeroImpl(firstHero, 20),
                new HeroImpl(secondHero, 20),
                BoardImpl.createEmptyBoard(boardHeight, boardWidth),
                Snapshot.Player.FIRST,
                3
        );

        boardInitializer.apply(snapshot.getBoard(), 16, UnitUtils.mobileUnitsConstructors());
        displayManager.drawSnapshot(snapshot, "New game started! " + firstHero + " vs " + secondHero);
    }


    private int findAvailableRandomSpot(NormalizedBoard normalizedBoard) {
        if (normalizedBoard.isFull()) {
            System.out.println("The board is full, no available spots.");
            return -1;
        }


        var random = new Random();
        int columnIndex = random.nextInt(normalizedBoard.getMaxColumnIndex() + 1);


        while (!normalizedBoard.canPlaceInColumn(columnIndex)) {
            columnIndex = random.nextInt(normalizedBoard.getMaxColumnIndex() + 1);
        }
        return columnIndex;
    }

    private int findAvailableRandomSpotWithoutFormation(NormalizedBoard normalizedBoard, MobileUnit unit) {
        var maxTries = normalizedBoard.getMaxColumnIndex() + 1;
        int tries = 0;

        while (tries < maxTries) {
            var columnIndex = findAvailableRandomSpot(normalizedBoard);
            if (columnIndex == -1)
                return -1; // No available spot found. Board is full.

            var board = normalizedBoard.getNormalizedBoard();
            var column = board[columnIndex];

            // First: check if column contains already at the top two same units. If so, skip this column
            if (column.size() >= 2) {
                if (UnitUtils.isInAttackFormation(unit, column.size(), columnIndex, normalizedBoard)) {
                    tries++;
                    continue;
                }
            }
            int currentRowIndex = column.size();

            // Second: Check if the adjacent columns at that row are not occupied by the same unit (that would form a wall)
            if (columnIndex > 0 && columnIndex < normalizedBoard.getMaxColumnIndex()) {
                var leftColumn = board[columnIndex - 1];
                var rightColumn = board[columnIndex + 1];

                if (leftColumn.size() > currentRowIndex && rightColumn.size() > currentRowIndex) {
                    var leftUnit = leftColumn.get(column.size());
                    var rightUnit = rightColumn.get(column.size());

                    if (leftUnit instanceof MobileUnit leftMobile && rightUnit instanceof MobileUnit rightMobile) {
                        if (leftMobile.matches(unit) && rightMobile.matches(unit)) {
                            tries++;
                            continue; // Skip this column, it would form a wall
                        }
                    }
                }
            }

            // Third: check if two columns to the left and right of the current column are not occupied by the same unit
            // - Check all left
            if (columnIndex >= 2) {
                var leftColumn = board[columnIndex - 1];
                var leftLeftColumn = board[columnIndex - 2];
                if (leftColumn.size() > column.size() && leftLeftColumn.size() > column.size()) {
                    var leftUnit = leftColumn.get(column.size());
                    var leftLeftUnit = leftLeftColumn.get(column.size());

                    if (leftUnit instanceof MobileUnit leftMobile && leftLeftUnit instanceof MobileUnit leftLeftMobile) {
                        if (leftMobile.matches(unit) && leftLeftMobile.matches(unit)) {
                            tries++;
                            continue; // Skip this column, it would form a wall
                        }
                    }
                }
            }
            // - Check all right
            if (columnIndex <= normalizedBoard.getMaxColumnIndex() - 2) {
                var rightColumn = board[columnIndex + 1];
                var rightRightColumn = board[columnIndex + 2];
                if (rightColumn.size() > column.size() && rightRightColumn.size() > column.size()) {
                    var rightUnit = rightColumn.get(column.size());
                    var rightRightUnit = rightRightColumn.get(column.size());

                    if (rightUnit instanceof MobileUnit rightMobile && rightRightUnit instanceof MobileUnit rightRightMobile) {
                        if (rightMobile.matches(unit) && rightRightMobile.matches(unit)) {
                            tries++;
                            continue; // Skip this column, it would form a wall
                        }
                    }
                }
            }

            // If we reached here, we found a valid spot
            return columnIndex;
        }
        System.out.println("No available spot found after " + maxTries + " tries.");
        return -1; // No available spot found after max tries
    }

    private void initializeBoardRandom(Board board, int amount, Function<MobileUnit.UnitColor, MobileUnit>[] unitConstructors) {
        var random = new Random();
        for (int i = 0; i < amount; i++) {
            UnitColor p1Color = UnitColor.values()[random.nextInt(3)],
                    p2Color = UnitColor.values()[random.nextInt(3)];
            MobileUnit unit1 = unitConstructors[random.nextInt(unitConstructors.length)].apply(p1Color),
                    unit2 = unitConstructors[random.nextInt(unitConstructors.length)].apply(p2Color);
            int p1Index = findAvailableRandomSpotWithoutFormation(snapshot.getNormalizedBoard(Player.FIRST), unit1),
                    p2Index = findAvailableRandomSpotWithoutFormation(snapshot.getNormalizedBoard(Player.SECOND), unit2);

            snapshot.getNormalizedBoard(Player.FIRST).addUnit(p1Index, unit1);
            snapshot.getNormalizedBoard(Player.SECOND).addUnit(p2Index, unit2);

        }
    }


    @Override
    public void exitGame() {
        snapshot = null;
        displayManager.drawHomeScreen();
    }

    @Override
    public void skipTurn() {
        handleSkipTurn(false);
    }

    public void skipTurn(boolean isBotTurn) {
        handleSkipTurn(isBotTurn);
    }

    private void handleSkipTurn(boolean isBotTurn) {

        if (snapshot == null) {
            System.out.println("Teh game is not active.");
            return;
        }

        if (!(snapshot instanceof GameSnapshot gs)) {
            System.out.println("Cannot skip the turn, the snapshot is wrong.");
            return;
        }
        var currentHero = gs.getHero(gs.getActivePlayer());
        if (!isBotTurn && currentHero.isBot()) {
            System.out.println("Cannot skip turn for enemy bot.");
            return;

        }

        try {
            GameSnapshotUtils.switchTurn((GameSnapshot) snapshot, displayManager);
        } catch (GameEndException e) {
            exitGame();
            return;
        }

        System.out.println("Turn skipped. The active player is now: " + gs.getActivePlayer());
        System.out.println("Remaining actions: " + gs.getNumberOfRemainingActions());

        displayManager.drawSnapshot(gs, "Turn skipped. It's now " + gs.getActivePlayer() + "'s turn.");
    }


    @Override
    public void callReinforcement() {
        if (!(snapshot instanceof GameSnapshot)) return;
        moveHandler.resetState();

        GameSnapshot gs = (GameSnapshot) snapshot;
        var board = (NormalizedBoardImpl) snapshot.getCurrentBoard();
        Snapshot.Player player = gs.getActivePlayer();
        int reinforcements = NormalizedBoardImpl.getRemovedUnitsCount(player);

        if (reinforcements <= 0) {
            displayManager.drawSnapshot(gs, "No reinforcements available.");
            return;
        }

        Random rng = new Random();
        int placed = 0;

        while (placed < reinforcements) {


            UnitColor color = UnitColor.values()[rng.nextInt(3)];
            int type = rng.nextInt(3);
            MobileUnit unit = switch (type) {
                case 0 -> new Butterfly(color);
                case 1 -> new Fairy(color);
                case 2 -> new Unicorn(color);
                default -> throw new IllegalStateException("Wrong unit type.");
            };
            int columnIndex = findAvailableRandomSpotWithoutFormation(board, unit);
            board.addUnit(columnIndex, unit);

            placed++;
        }

        displayManager.drawSnapshot(gs, placed + " reinforcements called!");
        consumeAction(gs, displayManager);
        NormalizedBoardImpl.resetRemovedUnitsCount(player);
    }


    @Override
    public void requestInformation(int rowIndex, int columnIndex) {
        // TODO: Arshad implement this method

    }


    @Override
    public void selectTile(int rowIndex, int columnIndex) {
        handleMove(rowIndex, columnIndex, false);
    }

    // This function will get called by the bot player.
    public void selectTile(int rowIndex, int columnIndex, boolean isBotMove) {
        handleMove(rowIndex, columnIndex, isBotMove);
    }


    // UPDATED move unit method (now you can overlay 2 same color units for an upgrade)
    private void handleMove(int rowIndex, int columnIndex, boolean isBotMove) {
        if (!isTileOwnedByActivePlayer(snapshot, rowIndex, displayManager, isBotMove)) return;

        if (moveHandler.handleMove(rowIndex, columnIndex, snapshot.getCurrentBoard())) {

            displayManager.drawSnapshot(snapshot, "Moved.");
            consumeAction((GameSnapshot) snapshot, displayManager);


        } else {
            displayManager.drawSnapshot(snapshot, "Not moved");
        }


    }


    // delete unit method
    // Walls can be deleted.
    private void handleDelete(int rowIndex, int columnIndex, boolean isBotMove) {
        if (!isTileOwnedByActivePlayer(snapshot, rowIndex, displayManager, isBotMove)) return;
        moveHandler.resetState();

        var board = snapshot.getCurrentBoard();
        var unit = board.getUnit(board.normalizeRowIndex(rowIndex), columnIndex);

        // The unit needs to be present and not in an attack formation
        var canBeDeleted = unit.isPresent() && unit.get() instanceof Wall ||
                !UnitUtils.isInAttackFormation((MobileUnit) unit.get(), board.normalizeRowIndex(rowIndex), columnIndex, board);


        if (canBeDeleted) {
            //counting for call reinforcement
            Snapshot.Player player = snapshot.getActivePlayer();
            NormalizedBoardImpl.countAsRemoved(player, unit.get());

            board.removeUnit(board.normalizeRowIndex(rowIndex), columnIndex);
            displayManager.drawSnapshot(snapshot, "Unit deleted! :D");
            consumeAction((GameSnapshot) snapshot, displayManager);
        } else {

            System.out.println("There is nothing toColumn delete here uwu");
        }
    }


    @Override
    public void deleteUnit(int rowIndex, int columnIndex) {
        handleDelete(rowIndex, columnIndex, false);
    }

    public void deleteUnit(int rowIndex, int columnIndex, boolean isBotMove) {
        handleDelete(rowIndex, columnIndex, isBotMove);
    }

    public Snapshot getSnapshot() {
        return snapshot;
    }


}
