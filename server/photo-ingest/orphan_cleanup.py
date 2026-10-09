"""Pure cleanup eligibility only. Never deletes and never trusts client references."""
def eligible_cleanup(*,actor_id,owner_id,order_id,object_order_id,storage_path,referenced,commit_outcome,upload_confirmed,server_reconciled):
    # Unknown commit/timeout is not permission to erase possibly committed evidence.
    if not server_reconciled or commit_outcome!='confirmed_failed':return False
    if not upload_confirmed or referenced:return False
    if not actor_id or actor_id!=owner_id or order_id!=object_order_id:return False
    if not isinstance(storage_path,str) or not storage_path.startswith(str(owner_id)+'/'):return False
    if '..' in storage_path.split('/'):return False
    return True
