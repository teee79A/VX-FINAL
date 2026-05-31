package it.unibz.inf.pp.clash.model.exceptions;

/**
 * Thrown when input tile coordinates (i.e. a row index and a column index) are not within the board's boundaries.
 */
public class CoordinatesOutOfBoardException extends InvalidCoordinatesException {

    public CoordinatesOutOfBoardException(int rowIndex, int columnIndex, int maxRowIndex, int maxColumnIndex) {
        super(
                rowIndex,
                columnIndex,
                String.format(
                        "The row index should be <= %d and the columIndex <= %d.",
                        maxRowIndex,
                        maxColumnIndex
                ));
    }
}
