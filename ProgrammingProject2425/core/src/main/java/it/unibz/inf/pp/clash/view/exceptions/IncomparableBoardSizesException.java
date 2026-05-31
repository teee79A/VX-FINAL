package it.unibz.inf.pp.clash.view.exceptions;

import it.unibz.inf.pp.clash.model.snapshot.Board;

public class IncomparableBoardSizesException extends RuntimeException {

    public IncomparableBoardSizesException(Board previousBoard, Board newBoard) {
        super(
                String.format("The previous board drawn on screen has dimensions (%s,%s)," +
                                "whereas the new one has dimensions (%s,%s).\n" +
                                "These two boards cannot be compared with each other",
                        previousBoard.getMaxRowIndex() + 1,
                        previousBoard.getMaxColumnIndex() + 1,
                        newBoard.getMaxRowIndex() + 1,
                        newBoard.getMaxColumnIndex() + 1
                ));
    }
}
