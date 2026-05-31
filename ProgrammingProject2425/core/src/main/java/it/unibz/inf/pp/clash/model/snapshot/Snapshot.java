package it.unibz.inf.pp.clash.model.snapshot;

import java.util.Optional;

import static it.unibz.inf.pp.clash.model.snapshot.Board.TileCoordinates;

public interface Snapshot {

    enum Player {FIRST, SECOND}

    /**
     * @return the current state of the board
     */
    Board getBoard();

    /**
     * @param player first or second player
     * @return the hero of the input {@code player}
     */
    Hero getHero(Player player);

    /**
     * @return first of second player, depending on whose turn it is
     */
    Player getActivePlayer();

    /**
     * @return the player that is not active
     */
    Player getNonActivePlayer();

    /**
     * @return the number of remaining actions for the active player
     */
    int getNumberOfRemainingActions();

    /**
     * @return if the active player has selected the initial tile of his/her next move, then returns the coordinates of
     * this tile.
     * Otherwise returns Optional.empty().
     */
    Optional<TileCoordinates> getOngoingMove();

    /**
     * @return the number of units that will enter the board if reinforcement is called for the input {@code player}
     */
    int getSizeOfReinforcement(Player player);

    NormalizedBoard getNormalizedBoard(Player player);

    NormalizedBoard getCurrentBoard();

    NormalizedBoard getNonCurrentBoard();

    void setActivePlayer(Player player);

}
