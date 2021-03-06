import { gql } from 'apollo-server-express';
import { Board } from 'database/entities/Board';
import { throwError, catchDBError } from '@Lib/error';
import { verifyToken } from '@Lib/utils';
import { User, findByPk } from 'database/entities/User';
import { getRepository, Repository, getManager } from 'typeorm';

export const typeDef = gql`
  type Board {
    pk: Int!
    user_pk: String!
    user_name: String!
    title: String!
    content: String!
    createdAt: Date!
    updatedAt: Date!
    isWrite: Boolean
    comment: [Comment]
  }

  extend type Query {
    board(board_pk: Int!, token: String): Board!
    myBoards(token: String!): [Board]!
    allBoards: [Board]!
    createBoard(token: String!, title: String!, content: String!): Boolean!
  }

  extend type Mutation {
    updateBoard(board_pk: Int!, title: String, content: String, token: String!): Boolean!
    deleteBoard(board_pk: Int!, token: String!): Boolean!
  }
`;

export const resolvers = {
  Query: {
    board: async (
      _: any,
      {
        board_pk,
        token
      }: {
        board_pk: Board['pk'];
        token: string | undefined;
      }
    ) => {
      const boardRepository: Repository<Board> = getRepository(Board);
      const user_pk: User['pk'] | undefined = token ? (verifyToken(token) as User).pk : undefined;

      const board: Board = await boardRepository.findOne({
        where: {
          pk: board_pk
        },
        relations: ['user', 'comment']
      });

      if (!board) {
        throwError('Not Found Board');
      }

      return {
        pk: board.pk,
        user_pk: board.user_pk,
        user_name: board.user.name,
        title: board.title,
        content: board.content,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        isWrite: board.user_pk === user_pk,
        comment: board.comment
      };
    },
    myBoards: async (_: any, { token }: { token: string }) => {
      const boardRepository: Repository<Board> = getRepository(Board);
      const userRepository: Repository<User> = getRepository(User);

      const pk: User['pk'] = (verifyToken(token) as User).pk;

      const user: User = await findByPk(userRepository, pk);

      if (!user) {
        throwError('Not Found User');
      }

      const board: Board[] = await boardRepository
        .find({
          where: {
            user_pk: user.pk
          }
        })
        .catch(catchDBError());

      if (!board.length) {
        throwError('Not Found Boards');
      }

      return board;
    },
    allBoards: async (_: any) => {
      const boards: Board[] = await getManager()
        .createQueryBuilder(Board, 'boards')
        .limit(5)
        .orderBy('boards.createdAt', 'DESC')
        .leftJoinAndSelect('boards.user', 'user')
        .getMany();

      if (boards.length < 1) {
        throwError('Not Found Boards');
      }

      return boards.map((board: Board) => ({
        pk: board.pk,
        user_pk: board.user_pk,
        user_name: board.user.name,
        title: board.title,
        content: board.content,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt
      }));
    },
    createBoard: async (
      _: any,
      {
        token,
        title,
        content
      }: {
        token: string;
        title: string;
        content: string;
      }
    ) => {
      const boardRepository: Repository<Board> = getRepository(Board);
      const userRepository: Repository<User> = getRepository(User);

      const pk: User['pk'] = (verifyToken(token) as User).pk;

      const user: User = await findByPk(userRepository, pk);

      if (!user) {
        throwError('Not Found User');
      }

      await boardRepository
        .save({
          user_pk: user.pk,
          title,
          content
        })
        .catch(catchDBError());

      return true;
    }
  },
  Mutation: {
    updateBoard: async (
      _: any,
      {
        board_pk,
        title,
        content,
        token
      }: {
        board_pk: Board['pk'];
        title: Board['title'] | undefined;
        content: Board['content'] | undefined;
        token: string;
      }
    ) => {
      const boardRepository: Repository<Board> = getRepository(Board);

      const user_pk: User['pk'] = (verifyToken(token) as User).pk;

      const board: Board = await boardRepository
        .findOne({
          where: {
            pk: board_pk
          }
        })
        .catch(catchDBError());

      if (!board) {
        throwError('Not Found Board');
      }

      if (board.user_pk !== user_pk) {
        throwError('Forbidden');
      }

      Object.assign(board, { title, content });

      await board.save().catch(catchDBError());

      return true;
    },
    deleteBoard: async (
      _: any,
      {
        board_pk,
        token
      }: {
        board_pk: Board['pk'];
        token: string;
      }
    ) => {
      const boardRepository: Repository<Board> = getRepository(Board);

      const user_pk: User['pk'] = (verifyToken(token) as User).pk;

      const board: Board = await boardRepository
        .findOne({
          where: {
            pk: board_pk
          }
        })
        .catch(catchDBError());

      if (!board) {
        throwError('Not Found Board');
      }

      if (board.user_pk !== user_pk) {
        throwError('Forbidden');
      }

      await board.remove().catch(catchDBError());

      return true;
    }
  }
};
