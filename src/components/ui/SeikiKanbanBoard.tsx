import React, { useState, useEffect, useMemo } from 'react';
import { Kanban, dropHandler, dropColumnHandler } from 'react-kanban-kit';
import type { BoardData, BoardItem, BoardProps } from 'react-kanban-kit';

type ConfigMap = BoardProps['configMap'];
type DropCardParams = Parameters<NonNullable<BoardProps['onCardMove']>>[0];
type DropColumnParams = Parameters<NonNullable<BoardProps['onColumnMove']>>[0];

export interface SeikiKanbanBoardProps<TCard, TColumn> {
  columns: TColumn[];
  cards: TCard[];
  getColumnId: (col: TColumn) => string;
  getColumnTitle: (col: TColumn) => string;
  getColumnColor?: (col: TColumn) => string;
  getCardId: (card: TCard) => string;
  getCardColumnId: (card: TCard) => string;
  renderCard: (card: TCard, column: TColumn) => React.ReactNode;
  renderColumnHeaderExtra?: (column: TColumn, cardsCount: number) => React.ReactNode;
  renderColumnFooter?: (column: TColumn) => React.ReactNode;
  onCardMove: (cardId: string, fromColumnId: string, toColumnId: string, position: number) => Promise<void>;
  onColumnMove?: (columnId: string, fromIndex: number, toIndex: number) => Promise<void>;
  onCardClick?: (card: TCard) => void;
  allowColumnDrag?: boolean;
  cardsGap?: number;
  fillWidth?: boolean;
}

export function SeikiKanbanBoard<TCard, TColumn>({
  columns,
  cards,
  getColumnId,
  getColumnTitle,
  getColumnColor,
  getCardId,
  getCardColumnId,
  renderCard,
  renderColumnHeaderExtra,
  renderColumnFooter,
  onCardMove,
  onColumnMove,
  onCardClick,
  allowColumnDrag = false,
  cardsGap = 10,
  fillWidth = false,
}: SeikiKanbanBoardProps<TCard, TColumn>) {
  // Map lookup for rapid card/col retrieval
  const columnMap = useMemo(() => {
    const map = new Map<string, TColumn>();
    columns.forEach((col) => map.set(getColumnId(col), col));
    return map;
  }, [columns, getColumnId]);

  const cardMap = useMemo(() => {
    const map = new Map<string, TCard>();
    cards.forEach((card) => map.set(getCardId(card), card));
    return map;
  }, [cards, getCardId]);

  // Transform generic props to BoardData for react-kanban-kit
  const buildBoardData = (): BoardData => {
    const colIds = columns.map(getColumnId);
    const data: BoardData = {
      root: {
        id: 'root',
        title: 'Root',
        children: colIds,
        totalChildrenCount: colIds.length,
        parentId: null,
      },
    };

    // Columns
    columns.forEach((col) => {
      const colId = getColumnId(col);
      const colCards = cards.filter((c) => getCardColumnId(c) === colId);
      const cardIds = colCards.map(getCardId);

      data[colId] = {
        id: colId,
        title: getColumnTitle(col),
        children: cardIds,
        totalChildrenCount: cardIds.length,
        parentId: 'root',
        content: col,
      };
    });

    // Cards
    cards.forEach((card) => {
      const cardId = getCardId(card);
      const colId = getCardColumnId(card);
      data[cardId] = {
        id: cardId,
        title: cardId,
        parentId: colId,
        children: [],
        totalChildrenCount: 0,
        type: 'card',
        content: card,
      };
    });

    return data;
  };

  const [dataSource, setDataSource] = useState<BoardData>(buildBoardData);

  useEffect(() => {
    setDataSource(buildBoardData());
  }, [columns, cards]);

  const configMap: ConfigMap = {
    card: {
      render: ({ data }: { data: BoardItem }) => {
        const cardObj = cardMap.get(data.id) || (data.content as TCard);
        const colObj = columnMap.get(data.parentId || '') || ({} as TColumn);
        return (
          <div
            onClick={() => cardObj && onCardClick?.(cardObj)}
            className="cursor-pointer transition-all hover:translate-y-[-1px]"
          >
            {cardObj && renderCard(cardObj, colObj)}
          </div>
        );
      },
      isDraggable: true,
    },
  };

  const handleCardMove = (move: DropCardParams) => {
    const updated = dropHandler(move, dataSource, () => {});
    setDataSource(updated);
    onCardMove(move.cardId, move.fromColumnId, move.toColumnId, move.position).catch(() => {
      // Revert on error
      setDataSource(buildBoardData());
    });
  };

  const handleColumnMove = (move: DropColumnParams) => {
    if (!onColumnMove) return;
    const updated = dropColumnHandler(move, dataSource);
    setDataSource(updated);
    onColumnMove(move.columnId, move.fromIndex, move.toIndex).catch(() => {
      setDataSource(buildBoardData());
    });
  };

  return (
    <Kanban
      dataSource={dataSource}
      configMap={configMap}
      allowColumnDrag={allowColumnDrag}
      cardsGap={cardsGap}
      onCardMove={handleCardMove}
      onColumnMove={handleColumnMove}
      rootClassName={fillWidth ? 'rkk-seiki-board rkk-fill-width' : 'rkk-seiki-board'}
      rootStyle={fillWidth ? { width: '100%' } : undefined}
      renderCardDragPreview={(card) => {
        const cardObj = cardMap.get(card.id) || (card.content as TCard);
        const colObj = columnMap.get(card.parentId || '') || ({} as TColumn);
        return (
          <div
            style={{
              backgroundColor: '#1e2026',
              borderRadius: '8px',
              border: '1.5px solid #c8b89a',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.8)',
              transform: 'rotate(4deg)',
              padding: '8px',
              pointerEvents: 'none',
            }}
          >
            {cardObj && renderCard(cardObj, colObj)}
          </div>
        );
      }}
      renderCardDragIndicator={() => (
        <div
          style={{
            height: 3,
            backgroundColor: '#c8b89a',
            borderRadius: 2,
            margin: '4px 0',
            boxShadow: '0 0 8px rgba(200, 184, 154, 0.8)',
          }}
        />
      )}
      renderColumnHeader={(colItem) => {
        const colObj = columnMap.get(colItem.id);
        const colCardsCount = colItem.children?.length || 0;
        const borderCol = colObj && getColumnColor ? getColumnColor(colObj) : '#c8b89a';

        return (
          <div
            className="mb-3 flex items-center justify-between border-b-2 pb-2 font-display text-[13.5px] font-bold text-white select-none"
            style={{ borderBottomColor: borderCol }}
          >
            <span style={{ color: '#ffffff' }}>{colItem.title}</span>
            {colObj && renderColumnHeaderExtra ? (
              renderColumnHeaderExtra(colObj, colCardsCount)
            ) : (
              <span className="text-[11px] font-normal text-white/70">{colCardsCount}</span>
            )}
          </div>
        );
      }}
      renderColumnFooter={(colItem) => {
        const colObj = columnMap.get(colItem.id);
        return colObj ? renderColumnFooter?.(colObj) : null;
      }}
      columnWrapperStyle={() => ({
        backgroundColor: '#141414',
        borderRadius: '12px',
        border: '1px solid rgba(242, 237, 228, 0.08)',
        padding: '12px',
        ...(fillWidth
          ? { flex: '1 1 0%', minWidth: '0', maxWidth: '100%' }
          : { minWidth: '260px' }),
      })}
      columnStyle={() => ({
        backgroundColor: 'transparent',
      })}
    />
  );
}

