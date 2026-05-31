package it.unibz.inf.pp.clash.view.screen.game;

import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot.Player;
import it.unibz.inf.pp.clash.model.snapshot.units.Unit;
import it.unibz.inf.pp.clash.view.screen.Compositor;
import it.unibz.inf.pp.clash.view.screen.sync.AnimationCounter;
import it.unibz.inf.pp.clash.view.singletons.ColorManager;
import it.unibz.inf.pp.clash.view.singletons.Dimensions;
import it.unibz.inf.pp.clash.view.singletons.FontManager;

import java.util.Optional;

import static it.unibz.inf.pp.clash.model.snapshot.Board.TileCoordinates;

public class BoardCompositor extends Compositor {

    private final EmptyBoardCellCompositor emptyCellCompositor;
    private final OccupiedBoardCellCompositor occupiedCellCompositor;

    public BoardCompositor(EventHandler eventHandler, boolean debug, AnimationCounter animationCounter) {
        super(eventHandler, animationCounter, debug);
        emptyCellCompositor = new EmptyBoardCellCompositor(eventHandler, debug, animationCounter);
        occupiedCellCompositor = new OccupiedBoardCellCompositor(eventHandler, debug, animationCounter);
    }

    /**
     * @param selectedTile coordinates of the tile selected on the board.
     *                     There can be at most one.
     *                     If there is none, then this parameter is null.
     */
    public Table drawPlayerBoard(Board previousBoard, Board newBoard, TileCoordinates selectedTile, Player player) {
        return drawBoard(
                player,
                previousBoard,
                newBoard,
                selectedTile,
                computeMinRowIndex(newBoard, player),
                computeMaxRowIndex(newBoard, player)
        );
    }

    private int computeMinRowIndex(Board board, Player player) {
        return player == Player.FIRST ?
                board.getMaxRowIndex() / 2 + 1 :
                0;
    }

    private int computeMaxRowIndex(Board board, Player player) {
        return player == Player.FIRST ?
                board.getMaxRowIndex() :
                board.getMaxRowIndex() / 2;
    }

    private Table drawBoard(Player player, Board previousBoard, Board newBoard, TileCoordinates selectedTile, int minRow, int maxRow) {
        Table drawnBoard = new Table();
        drawnBoard.setDebug(debug);
        if (player == Player.SECOND) {
            drawColumnIndices(newBoard.getMaxColumnIndex(), drawnBoard);
            addVerticalSpace(drawnBoard, Dimensions.instance().getSmallSpace());
        }
        for (int currentRow = minRow; currentRow <= maxRow; currentRow++) {
            drawRow(previousBoard, newBoard, currentRow, selectedTile, minRow, maxRow, drawnBoard);
        }
        if (player == Player.FIRST) {
            addVerticalSpace(drawnBoard, Dimensions.instance().getSmallSpace());
            drawColumnIndices(newBoard.getMaxColumnIndex(), drawnBoard);
        }
        return drawnBoard;
    }

    private void drawColumnIndices(int maxColumnIndex, Table drawnBoard) {
        drawnBoard.add(createIndexLabel(""));
        for (int currentColumn = 0; currentColumn <= maxColumnIndex; currentColumn++) {
            drawnBoard.add(createColumnIndexLabel(currentColumn));
        }
        drawnBoard.row();
    }

    private void drawRow(Board previousBoard, Board newboard, int currentRow, TileCoordinates selectedTile, int minRow,
                         int maxRow, Table drawnBoard) {
        drawnBoard.add(createLeftRowIndexLabel(currentRow));
        for (int currentColumn = 0; currentColumn <= newboard.getMaxColumnIndex(); currentColumn++) {
            drawnBoard.add(
                            drawCell(
                                    previousBoard,
                                    newboard,
                                    minRow,
                                    maxRow,
                                    currentRow,
                                    currentColumn,
                                    isSelectedTile(
                                            currentRow,
                                            currentColumn,
                                            selectedTile
                                    )))
                    .expand()
                    .fill()
                    .uniform()
                    .width(Dimensions.instance().getTileWidth());
        }
        drawnBoard.add(createRightRowIndexLabel(currentRow));
        drawnBoard.row();
    }

    private Label createColumnIndexLabel(int index) {
        return createIndexLabel(String.valueOf(index));
    }

    private Label createLeftRowIndexLabel(int index) {
        return createIndexLabel(index + "  ");
    }

    private Label createRightRowIndexLabel(int index) {
        return createIndexLabel("  " + index);
    }

    private Label createIndexLabel(String value) {
        return FontManager.instance().getLabel(
                value,
                FontManager.FontType.CELL,
                ColorManager.instance().getColor(ColorManager.GuiColor.CELL_INDEX)
        );
    }

    private boolean isSelectedTile(int currentRow, int currentColumn, TileCoordinates selectedTile) {
        return selectedTile != null &&
                selectedTile.rowIndex() == currentRow &&
                selectedTile.columnIndex() == currentColumn;
    }

    private Table drawCell(Board previousBoard, Board newBoard, int minRow, int maxRow,
                           int currentRow, int currentColumn, boolean isSelectedTile) {


        Optional<Unit> optionalUnit = newBoard.getUnit(currentRow, currentColumn);
        if (optionalUnit.isEmpty()) {
            return emptyCellCompositor.drawCell(
                    currentRow,
                    currentColumn,
                    isSelectedTile
            );
        }

        Unit unit = optionalUnit.get();

        Unit previousUnit = previousBoard == null ?
                null :
                previousBoard.getUnit(currentRow, currentColumn).orElse(null);

        if (isMultitileUnit(unit, newBoard, currentRow, currentColumn)) {
            return occupiedCellCompositor.drawCell(
                    currentRow,
                    currentColumn,
                    previousUnit,
                    unit,
                    isUpperBoundary(newBoard, unit, minRow, currentRow, currentColumn),
                    isRightBoundary(newBoard, unit, currentRow, currentColumn),
                    isLowerBoundary(newBoard, unit, maxRow, currentRow, currentColumn),
                    isLeftBoundary(newBoard, unit, currentRow, currentColumn),
                    isSelectedTile
            );
        }
        return occupiedCellCompositor.drawCell(
                currentRow,
                currentColumn,
                previousUnit,
                unit,
                false,
                false,
                false,
                false,
                isSelectedTile
        );

    }

    private boolean isMultitileUnit(Unit unit, Board board, int currentRow, int currentColumn) {
        return sameUnit(unit, board, currentRow + 1, currentColumn) ||
                sameUnit(unit, board, currentRow - 1, currentColumn) ||
                sameUnit(unit, board, currentRow, currentColumn + 1) ||
                sameUnit(unit, board, currentRow, currentColumn - 1);
    }

    private boolean sameUnit(Unit unit, Board board, int row, int column) {
        if (!board.areValidCoordinates(row, column)) {
            return false;
        }
        Optional<Unit> adjacentUnit = board.getUnit(row, column);
        return adjacentUnit.isPresent() && adjacentUnit.get() == unit;
    }

    /**
     * Assumption: unit {@code unit} stands on the tile at {@code currentRow, currentColumn}.
     *
     * @return true iff the tile at {@code currentRow, currentColumn} is an upper boundary of a (possibly multitile) unit.
     */
    private boolean isUpperBoundary(Board board, Unit unit, int minRow, int currentRow, int currentColumn) {
        if (currentRow == minRow) {
            return true;
        }
        return differentUnits(
                unit,
                board.getUnit(
                        currentRow - 1,
                        currentColumn
                ));
    }

    /**
     * Assumption: unit {@code unit} stands on the tile at {@code currentRow, currentColumn}.
     *
     * @return true iff the tile at {@code currentRow, currentColumn} is an upper boundary of a (possibly multitile) unit.
     */
    private boolean isRightBoundary(Board board, Unit unit, int currentRow, int currentColumn) {
        if (currentColumn == board.getMaxColumnIndex()) {
            return true;
        }
        return differentUnits(
                unit,
                board.getUnit(
                        currentRow,
                        currentColumn + 1
                ));
    }

    /**
     * Assumption: unit {@code unit} stands on the tile at {@code currentRow, currentColumn}.
     *
     * @return true iff the tile at {@code currentRow, currentColumn} is an upper boundary of a (possibly multitile) unit.
     */
    private boolean isLowerBoundary(Board board, Unit unit, int maxRow, int currentRow, int currentColumn) {
        if (currentRow == maxRow) {
            return true;
        }
        return differentUnits(
                unit,
                board.getUnit(
                        currentRow + 1,
                        currentColumn
                ));
    }

    /**
     * Assumption: unit {@code unit} stands on the tile at {@code currentRow, currentColumn}.
     *
     * @return true iff the tile at {@code currentRow, currentColumn} is an upper boundary of a (possibly multitile) unit.
     */
    private boolean isLeftBoundary(Board board, Unit unit, int currentRow, int currentColumn) {
        if (currentColumn == 0) {
            return true;
        }
        return differentUnits(
                unit,
                board.getUnit(
                        currentRow,
                        currentColumn - 1
                ));
    }

    private boolean differentUnits(Unit unit1, Optional<Unit> unit2) {
        return unit2.isEmpty() ? true : !(unit1 == unit2.get());
    }
}
