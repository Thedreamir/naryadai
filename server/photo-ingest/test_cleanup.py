import unittest
from orphan_cleanup import eligible_cleanup
class TestCleanup(unittest.TestCase):
 def test_narrow(self):
  case=dict(actor_id='owner',owner_id='owner',order_id=3,object_order_id=3,storage_path='owner/after.jpg',referenced=False,commit_outcome='confirmed_failed',upload_confirmed=True,server_reconciled=True)
  self.assertTrue(eligible_cleanup(**case))
  for key,value in [('actor_id','other'),('object_order_id',4),('storage_path','other/after.jpg'),('referenced',True),('commit_outcome','unknown'),('commit_outcome','committed'),('server_reconciled',False),('upload_confirmed',False)]:
   with self.subTest(key=key,value=value):self.assertFalse(eligible_cleanup(**{**case,key:value}))
if __name__=='__main__':unittest.main()
