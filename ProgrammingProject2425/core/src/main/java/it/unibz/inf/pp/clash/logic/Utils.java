package it.unibz.inf.pp.clash.logic;


import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.snapshot.NormalizedBoard;

public class Utils {
    public static String getBoardString(NormalizedBoard board) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i <= board.getMaxRowIndex(); i++) {
            for (int j = 0; j <= board.getMaxColumnIndex(); j++) {
                var unitMaybe = board.getUnit(i, j);
                unitMaybe.ifPresentOrElse(
                        unit -> sb.append(unit.getPrintString()),
                        () -> sb.append("  -  "));
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    public static void PrintBoard(Board board) {
        System.out.println("---Board---");
        for (int i = 0; i <= board.getMaxRowIndex(); i++) {
            for (int j = 0; j <= board.getMaxColumnIndex(); j++) {
                System.out.print(board.getUnit(i, j).isEmpty() ? "0" : "1");
            }
            System.out.println();
        }
    }

}
