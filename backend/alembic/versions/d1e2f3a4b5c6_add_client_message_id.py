"""add client_message_id to messages table

Revision ID: d1e2f3a4b5c6
Revises: c443465f7a87
Create Date: 2026-08-06 19:06:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c443465f7a87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('client_message_id', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_messages_client_message_id'), 'messages', ['client_message_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_messages_client_message_id'), table_name='messages')
    op.drop_column('messages', 'client_message_id')
