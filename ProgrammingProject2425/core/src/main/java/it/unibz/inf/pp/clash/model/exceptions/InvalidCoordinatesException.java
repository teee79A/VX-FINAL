package it.unibz.inf.pp.clash.model.exceptions;

public class InvalidCoordinatesException extends RuntimeException {


    public InvalidCoordinatesException(int rowIndex, int columnIndex, String appendedString) {
        super(
                String.format(
                        "Invalid tile coordinates: (rowIndex:%d, columnIndex:%d).\n%s",
                        rowIndex,
                        columnIndex,
                        appendedString
                ));
    }
}
