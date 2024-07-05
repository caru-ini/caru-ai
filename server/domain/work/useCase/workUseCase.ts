import type { LoadingWorkEntity } from 'api/@types/work';
import { transaction } from 'service/prismaClient';
import { s3 } from 'service/s3Client';
import { workMethod } from '../model/workMethod';
import { novelQuery } from '../repository/novelQuery';
import { workCommand } from '../repository/workCommand';
import { workEvent } from './../event/workevent';

export const workUseCase = {
  create: (novelUrl: string): Promise<LoadingWorkEntity> =>
    transaction('RepeatableRead', async (tx) => {
      const { title, author, html } = await novelQuery.scrape(novelUrl);
      const loadingWork = workMethod.create({ novelUrl, title, author });

      await workCommand.save(tx, loadingWork);

      workEvent.workCreated({ loadingWork, html });

      return loadingWork;
    }),
  complete: (loadingWork: LoadingWorkEntity, image: Buffer): Promise<void> =>
    transaction('RepeatableRead', async (tx) => {
      const completedWork = workMethod.complete(loadingWork);
      await workCommand.save(tx, completedWork);
      await s3.putImage(`works/${loadingWork.id}/image.png`, image);
    }),
  failure: (loadingWork: LoadingWorkEntity, errorMsg: string): Promise<void> =>
    transaction('RepeatableRead', async (tx) => {
      const failedWork = workMethod.failure(loadingWork, errorMsg);
      await workCommand.save(tx, failedWork);
    }),
};